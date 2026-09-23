"""Read carrier bills without inferring charges or adding tax to supplied totals."""
import csv
import io
import math
import re
import zipfile
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

from fastapi import HTTPException

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_ROWS = 50000


def normalized(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


AWB_HEADERS_PRIMARY = {
    "awb", "awbno", "awbnumber", "hawb", "hawbno", "cawbno",
    "airwaybillno", "airwaybillnumber", "airwaybill", "airwaybillnum", "airwaybill#",
    "waybillnum", "waybillno", "waybillnumber", "waybill", "waybill#",
    "trackingno", "trackingnumber", "tracking#", "tracking",
    "consignmentno", "consignmentnumber", "cnno", "cnnumber", "consignment",
    "docketno", "docketnumber", "docketnum", "docket",
    "lrno", "lrnumber", "lrnum", "manifestno",
}
AWB_HEADERS_SECONDARY = {
    "referenceno", "referencenumber", "refno", "refnumber", "ref#",
    "forwardingno", "forwardingnumber", "forwardingawb", "forwarding",
    "orderno", "orderid", "shippmentno", "shipmentid",
}

# These aliases apply to every carrier. Higher-priority groups describe a more
# explicit final charge. Never infer a total from a substring such as "total"
# in "total weight", "total GST", or "subtotal".
TOTAL_HEADER_GROUPS = [
    # Rank 1: Explicit Grand / Final / Billed Total
    {"grandtotal", "grandtotalamount", "grandtotalamt", "finaltotal",
     "finalamount", "finalamt", "finalbillamount", "finalbilledamount",
     "invoicetotal", "invoicetotalamount", "invoiceamount",
     "billtotal", "billtotalamount", "billamount", "billedtotal", "billedamount",
     "totalbilledamount", "totalbillamount", "totalinvoiceamount",
     "totalpayable", "totalamountpayable", "amountpayable", "netpayable",
     "netamountpayable", "netpayableamount", "payableamount"},
    # Rank 2: Total Amount / Total Amt / Total Charges
    {"totalamount", "totalamt", "total", "totalcharges", "totalcharge",
     "totalcost", "totalshipmentcost", "shipmenttotal", "shipmenttotalamount",
     "totalinr", "totallkr", "totalaed", "totalusd", "totaltaxableamount",
     "tot", "totamt", "totalvalue"},
    # Rank 3: Net Amount / Net Charges / Net Total
    {"netamount", "netamt", "nettotal", "nettotalamount", "netcharges", "netcharge", "netcost", "netamtinr"},
    # Rank 4: Gross Amount / Gross Revenue
    {"grossrevenue", "grossamount", "grossamt", "ntotamount", "grossvalue", "grosscharge", "grosscharges"},
    # Rank 5: Actual Cost / Provider Cost / Total Freight
    {"actualcost", "actualamount", "providercost", "cost", "totalfreight", "totalfreightcharge"},
    # Rank 6: General Amount
    {"amount", "amt", "charge", "charges", "revenue", "freightamount", "freight"},
]


def total_rank(value):
    # Currency/unit decorations, whitespace, case, punctuation and underscores
    # do not change the meaning of the header. Tax-exclusive labels do.
    label = re.sub(r"\b(?:INR|RS\.?|RUPEES|USD|AED|EUR|GBP)\b", "", str(value or ""), flags=re.I)
    name = normalized(label)
    inclusive = re.fullmatch(
        r"(.+?)(?:including|inclusiveof|incl|with)(?:all)?(?:gst|tax|taxes)(?:\d+)?", name
    )
    if inclusive:
        base = inclusive.group(1)
        if any(base in group for group in TOTAL_HEADER_GROUPS):
            return 0
    for rank, group in enumerate(TOTAL_HEADER_GROUPS, 1):
        if name in group:
            return rank
    return None


def columns(row):
    names = [normalized(c) for c in row]
    primary_awbs = [i for i, name in enumerate(names) if name in AWB_HEADERS_PRIMARY]
    secondary_awbs = [i for i, name in enumerate(names) if name in AWB_HEADERS_SECONDARY]
    awbs = primary_awbs if primary_awbs else secondary_awbs
    if not awbs:
        return None
    # If multiple candidates, pick the first primary AWB or first candidate
    awb_col = awbs[0]

    candidates = [(rank, i) for i, value in enumerate(row) if (rank := total_rank(value)) is not None]
    if not candidates:
        return None
    best_rank = min(rank for rank, _ in candidates)
    best_matches = [i for rank, i in candidates if rank == best_rank]
    # Pick the rightmost column matching best rank (standard for invoice/table totals)
    total_col = max(best_matches)
    if awb_col == total_col:
        return None
    return awb_col, total_col


def amount(value, location):
    text = str(value if value is not None else "").strip()
    text = re.sub(r"^(?:INR|Rs\.?|₹)\s*", "", text, flags=re.I)
    if not re.fullmatch(r"(?:\d+|\d{1,3}(?:,\d{2,3})+)(?:\.\d+)?", text):
        raise ValueError(f"{location}: missing or invalid billed total ({text[:40]}).")
    try:
        result = Decimal(text.replace(",", "")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if not math.isfinite(float(result)):
            raise InvalidOperation
        return float(result)
    except (InvalidOperation, OverflowError):
        raise ValueError(f"{location}: invalid billed total.")


def awb_text(value):
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value if value is not None else "").strip()


def parse_table(rows, source, inherited_mapping=None):
    entries, mappings, warnings = [], [], []
    mapping = inherited_mapping
    for number, row in enumerate(rows, 1):
        if number > MAX_ROWS:
            raise ValueError(f"{source}: maximum {MAX_ROWS:,} rows allowed.")
        row = list(row)
        if not any(v is not None and str(v).strip() for v in row):
            continue
        detected = columns(row)
        if detected:
            mapping = detected
            info = {
                "source": source,
                "awb_column": str(row[mapping[0]]).strip(),
                "total_column": str(row[mapping[1]]).strip(),
                "awb_index": mapping[0],
                "total_index": mapping[1],
            }
            if info not in mappings:
                mappings.append(info)
            continue
        if mapping is None:
            continue
        a, t = mapping
        if a >= len(row) or t >= len(row):
            continue
        raw_awb = row[a]
        raw_val = row[t]
        awb = awb_text(raw_awb)
        first = next((str(v).strip() for v in row if v is not None and str(v).strip()), "")
        # Aramex and others insert non-charge service descriptions between shipment rows.
        if first.lower().startswith("add on services:") and not awb:
            continue
        norm_awb = normalized(awb)
        if not awb or norm_awb in {"total", "grandtotal", "subtotal", "summary", "count", "othersws", "page", "pageno", "remarks", "date", "sno", "srno"}:
            continue
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_/-]*", awb):
            continue
        try:
            val = amount(raw_val, f"{source}, row {number}")
            entries.append({"awb": awb, "actual_cost": val})
        except Exception:
            continue
    return entries, mappings, warnings


def parse_pdf_text_lines(text, source):
    """Fallback parser for PDF pages where extract_tables fails to detect borders."""
    entries, mappings, warnings = [], [], []
    lines = text.splitlines()
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        lower_line = line.lower()
        if any(lower_line.startswith(prefix) for prefix in ["add on services:", "corporate office:", "cin number:", "reference number:", "date :", "page :", "to :", "tel :", "fax :", "customer no."]):
            continue
        tokens = line.split()
        if len(tokens) < 2:
            continue
        # Check if line contains a header
        if any(h in normalized(t) for t in tokens for h in ["hawb", "airwaybill", "waybillnum", "awbno"]) and any(t in normalized(tok) for tok in tokens for t in ["netamount", "totalamt", "totalamount", "grossamount", "basecharge"]):
            continue
        # Find monetary total (usually the last numeric token with decimals or commas)
        cost_val = None
        for tok in reversed(tokens):
            clean_tok = re.sub(r"^(?:INR|Rs\.?|₹)\s*", "", tok, flags=re.I).replace(",", "")
            if re.fullmatch(r"\d+(?:\.\d{1,2})?", clean_tok):
                try:
                    c = float(clean_tok)
                    if math.isfinite(c) and c >= 0:
                        cost_val = c
                        break
                except ValueError:
                    pass
        if cost_val is None:
            continue
        # Find AWB token (alphanumeric 6-30 chars, usually token 0, 1, or 2)
        awb_candidate = None
        for i in range(min(5, len(tokens))):
            cand = tokens[i].strip(".,;:()")
            # Exclude row index numbers like "1", "2", "3"
            if cand.isdigit() and len(cand) <= 3 and i == 0:
                continue
            # Exclude date tokens like "08/07/26" or "2026-08-08"
            if re.match(r"\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}", cand):
                continue
            # AWB is typically alphanumeric 6-30 chars
            if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_/-]{4,30}", cand) and normalized(cand) not in {"total", "grandtotal", "subtotal", "othersws", "add", "annexure", "page"}:
                awb_candidate = cand
                break
        if awb_candidate and cost_val is not None:
            entries.append({"awb": awb_candidate, "actual_cost": cost_val})
    if entries:
        mappings.append({"source": source, "awb_column": "AWB (Text Pattern)", "total_column": "Total (Text Pattern)"})
    return entries, mappings, warnings


def parse_bill_file(content, filename, parse_plain_text):
    """Return shipment entries plus the source columns used for the preview."""
    extension = Path(filename or "").suffix.lower()
    if extension not in {".csv", ".tsv", ".txt", ".xlsx", ".xls", ".pdf"}:
        raise HTTPException(400, "Upload an Excel (.xlsx/.xls), CSV, TSV, TXT, or PDF bill.")
    if not content:
        raise HTTPException(400, "The uploaded bill is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Bill files must be 20 MB or smaller.")
    entries, mappings, warnings = [], [], []

    def collect(rows, source, inherited_mapping=None):
        found, mapped, skipped = parse_table(rows, source, inherited_mapping=inherited_mapping)
        entries.extend(found)
        mappings.extend(mapped)
        warnings.extend(skipped)
        if len(entries) > MAX_ROWS:
            raise ValueError(f"Maximum {MAX_ROWS:,} shipment rows allowed per upload.")
        return bool(mapped), mapped

    try:
        if extension in {".csv", ".tsv", ".txt"}:
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = content.decode("cp1252")
            try:
                dialect = csv.Sniffer().sniff(text[:16000], delimiters=",;\t")
                rows = list(csv.reader(io.StringIO(text), dialect))
                mapped, _ = collect(rows, filename)
            except csv.Error:
                mapped = False
            if not mapped:
                entries = parse_plain_text(text)
                mappings = [{"source": filename, "awb_column": "AWB (first column)", "total_column": "Cost (second column)"}]
        elif extension == ".xlsx":
            import openpyxl
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(i.file_size for i in archive.infolist()) > 100 * 1024 * 1024:
                    raise ValueError("Expanded workbook exceeds 100 MB. Split it into smaller bills.")
            workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
            try:
                for sheet in workbook:
                    mapped, _ = collect(sheet.values, sheet.title)
                    if not mapped:
                        warnings.append(f"Sheet '{sheet.title}' has no recognized AWB and total headers; excluded.")
            finally:
                workbook.close()
        elif extension == ".xls":
            import xlrd
            workbook = xlrd.open_workbook(file_contents=content, on_demand=True)
            try:
                for sheet in workbook.sheets():
                    mapped, _ = collect((sheet.row_values(i) for i in range(sheet.nrows)), sheet.name)
                    if not mapped:
                        warnings.append(f"Sheet '{sheet.name}' has no recognized AWB and total headers; excluded.")
            finally:
                workbook.release_resources()
        else:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                if len(pdf.pages) > 100:
                    raise ValueError("PDF bills must contain 100 pages or fewer.")
                active_mapping = None
                for page_number, page in enumerate(pdf.pages, 1):
                    text_content = (page.extract_text() or "").strip()
                    if not text_content:
                        continue
                    found_on_page = False
                    # 1. Try table extraction with line and text strategies
                    for settings in [
                        {},
                        {"vertical_strategy": "text", "horizontal_strategy": "text", "snap_tolerance": 5},
                        {"vertical_strategy": "text", "horizontal_strategy": "lines"},
                        {"vertical_strategy": "lines", "horizontal_strategy": "text"},
                    ]:
                        try:
                            tables = page.extract_tables(table_settings=settings) if settings else page.extract_tables()
                            for table in tables:
                                if not table or len(table) < 1:
                                    continue
                                found, mapped, skipped = parse_table(table, f"Page {page_number}", inherited_mapping=active_mapping)
                                if mapped:
                                    active_mapping = (mapped[0]["awb_index"], mapped[0]["total_index"])
                                if found:
                                    entries.extend(found)
                                    mappings.extend(mapped)
                                    warnings.extend(skipped)
                                    found_on_page = True
                                    break
                            if found_on_page:
                                break
                        except Exception:
                            continue
                    
                    # 2. Fallback to line-by-line text parsing if table extraction missed it
                    if not found_on_page and text_content:
                        text_entries, text_mappings, text_skipped = parse_pdf_text_lines(text_content, f"Page {page_number}")
                        if text_entries:
                            entries.extend(text_entries)
                            mappings.extend(text_mappings)
                            warnings.extend(text_skipped)
                            found_on_page = True

        if not entries:
            raise ValueError("No shipment rows found. The bill must include an AWB column and a billed total column.")
        return entries, {"columns": mappings, "warnings": warnings, "row_count": len(entries)}
    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(503, "Excel/PDF import dependencies are unavailable. Install the backend requirements and restart the server.")
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        raise HTTPException(400, "Unable to read this bill. Check that it is a valid, unencrypted file and upload it again.")
