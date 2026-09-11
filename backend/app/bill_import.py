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


AWB_HEADERS = {"awb", "awbno", "awbnumber", "hawb", "hawbno", "cawbno",
               "airwaybillno", "airwaybillnumber", "airwaybill", "waybillnum",
               "waybill", "waybillno", "waybillnumber", "trackingnumber"}
# These aliases apply to every carrier. Higher-priority groups describe a more
# explicit final charge. Never infer a total from a substring such as "total"
# in "total weight", "total GST", or "subtotal".
TOTAL_HEADER_GROUPS = [
    {"grandtotal", "grandtotalamount", "grandtotalamt", "finaltotal",
     "finalamount", "finalamt", "finalbillamount", "finalbilledamount",
     "invoicetotal", "invoicetotalamount", "invoiceamount",
     "billtotal", "billtotalamount", "billamount", "billedtotal", "billedamount",
     "totalbilledamount", "totalbillamount", "totalinvoiceamount",
     "totalpayable", "totalamountpayable", "amountpayable", "netpayable",
     "netamountpayable", "netpayableamount", "payableamount"},
    {"totalamount", "totalamt", "total", "totalcharges", "totalcharge",
     "totalcost", "totalshipmentcost", "shipmenttotal", "shipmenttotalamount"},
    {"netamount", "netamt", "nettotal", "nettotalamount", "netcharges", "netcharge", "netcost"},
    {"ntotamount"},
    {"grossrevenue", "grossamount", "grossamt"},
    {"actualcost", "actualamount", "providercost", "cost"},
    {"amount", "amt"},
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
    awbs = [i for i, name in enumerate(names) if name in AWB_HEADERS]
    if not awbs:
        return None
    if len(awbs) != 1:
        raise ValueError("Multiple AWB columns found. Keep one shipment AWB column.")
    candidates = [(rank, i) for i, value in enumerate(row) if (rank := total_rank(value)) is not None]
    if not candidates:
        raise ValueError("AWB column found but no recognized billed total. Rename the final shipment charge column to 'Total' or 'Net Amount'.")
    best = min(rank for rank, _ in candidates)
    matches = [i for rank, i in candidates if rank == best]
    if len(matches) != 1:
        labels = ", ".join(str(row[i]) for i in matches)
        raise ValueError(f"Multiple possible billed totals: {labels}. Keep one final billed total column and remove or clearly relabel the others.")
    return awbs[0], matches[0]


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


def parse_table(rows, source):
    entries, mappings, warnings = [], [], []
    mapping = None
    for number, row in enumerate(rows, 1):
        if number > MAX_ROWS:
            raise ValueError(f"{source}: maximum {MAX_ROWS:,} rows allowed.")
        row = list(row)
        if not any(v is not None and str(v).strip() for v in row):
            continue
        detected = columns(row)
        if detected:
            mapping = detected
            info = {"source": source, "awb_column": str(row[mapping[0]]), "total_column": str(row[mapping[1]])}
            if info not in mappings:
                mappings.append(info)
            continue
        if mapping is None:
            continue
        a, t = mapping
        awb = awb_text(row[a] if a < len(row) else None)
        first = next((str(v).strip() for v in row if v is not None and str(v).strip()), "")
        # Aramex inserts non-charge service descriptions between shipment rows.
        if first.lower().startswith("add on services:") and not awb:
            continue
        if not awb or normalized(awb) in {"total", "grandtotal", "subtotal"}:
            warnings.append(f"{source}, row {number}: summary or row without an AWB excluded.")
            continue
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_/-]*", awb):
            raise ValueError(f"{source}, row {number}: invalid AWB '{awb[:50]}'. Remove non-shipment charges or correct the AWB.")
        entries.append({"awb": awb, "actual_cost": amount(row[t] if t < len(row) else None, f"{source}, row {number}")})
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

    def collect(rows, source):
        found, mapped, skipped = parse_table(rows, source)
        entries.extend(found)
        mappings.extend(mapped)
        warnings.extend(skipped)
        if len(entries) > MAX_ROWS:
            raise ValueError(f"Maximum {MAX_ROWS:,} shipment rows allowed per upload.")
        return bool(mapped)

    try:
        if extension in {".csv", ".tsv", ".txt"}:
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = content.decode("cp1252")
            try:
                dialect = csv.Sniffer().sniff(text[:16000], delimiters=",;\t")
                rows = csv.reader(io.StringIO(text), dialect)
                mapped = collect(rows, filename)
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
                    if not collect(sheet.values, sheet.title):
                        warnings.append(f"Sheet '{sheet.title}' has no recognized AWB and total headers; excluded.")
            finally:
                workbook.close()
        elif extension == ".xls":
            import xlrd
            workbook = xlrd.open_workbook(file_contents=content, on_demand=True)
            try:
                for sheet in workbook.sheets():
                    if not collect((sheet.row_values(i) for i in range(sheet.nrows)), sheet.name):
                        warnings.append(f"Sheet '{sheet.name}' has no recognized AWB and total headers; excluded.")
            finally:
                workbook.release_resources()
        else:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                if len(pdf.pages) > 100:
                    raise ValueError("PDF bills must contain 100 pages or fewer.")
                for page_number, page in enumerate(pdf.pages, 1):
                    if not (page.extract_text() or "").strip():
                        raise ValueError(f"PDF page {page_number} has no readable text. Run OCR on scanned pages, then upload the searchable PDF or Excel bill.")
                    found_table = False
                    for table in page.extract_tables():
                        found_table = collect(table, f"Page {page_number}") or found_table
                    if not found_table:
                        raise ValueError(f"PDF page {page_number}: could not identify a table with AWB and total columns. Upload a searchable table PDF or the Excel/CSV bill.")
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
