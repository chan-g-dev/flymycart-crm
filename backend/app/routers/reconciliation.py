# ================================================================
# FLY MY CART CRM - PROVIDER RECONCILIATION ROUTER (routers/reconciliation.py)
# ================================================================

import uuid
import datetime
import re
import csv
import io
import math
from app.cache import cache_engine
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, File, UploadFile, Form, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import Shipment, ReconciliationBatch, ReconciliationItem, AuditLog
from app.schemas import ReconciliationProcessRequest, ReconciliationBatchOut
from app.finance_engine import calculate_gross_profit, match_provider_bill_entries
from app.auth import create_audit_log
from app.dependencies import require_permission
from app.permissions import PermissionCode
from app.bill_import import parse_bill_file, MAX_UPLOAD_BYTES
from starlette.concurrency import run_in_threadpool

reconciliation_router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])

def parse_bill_text(text):
    """Read exactly AWB + amount; reject ambiguous rows instead of guessing a price."""
    entries = []
    for number, line in enumerate(text.splitlines(), 1):
        line = line.strip().lstrip("\ufeff")
        if not line:
            continue
        delimiter = "\t" if "\t" in line else ";" if ";" in line else "," if "," in line and not re.search(r"\s", line.split(",")[0]) else None
        parts = next(csv.reader([line], delimiter=delimiter)) if delimiter else line.split(maxsplit=1)
        if parts[0].strip().lower() in {"awb", "awb no", "awb number"}:
            continue
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail=f"Line {number}: use exactly AWB and Cost columns; quote amounts containing commas in CSV")
        awb, amount = [v.strip() for v in parts]
        amount = amount.removeprefix("?").strip()
        if not awb or not re.fullmatch(r"(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{2,3})+)(?:\.[0-9]{1,2})?", amount):
            raise HTTPException(status_code=400, detail=f"Line {number}: invalid AWB or cost; use a non-negative amount with at most two decimals")
        cost = float(amount.replace(",", ""))
        if not math.isfinite(cost):
            raise HTTPException(status_code=400, detail=f"Line {number}: invalid cost")
        entries.append({"awb": awb, "actual_cost": cost})
    return entries


@reconciliation_router.get("/batches", response_model=List[ReconciliationBatchOut])
def get_reconciliation_batches(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(ReconciliationBatch).options(joinedload(ReconciliationBatch.items)).order_by(desc(ReconciliationBatch.created_at), ReconciliationBatch.id)
    response.headers["X-Total-Count"] = str(query.count())
    return query.limit(limit).offset(offset).all()

@reconciliation_router.get("/batches/{batch_id}", response_model=ReconciliationBatchOut)
def get_reconciliation_batch(
    batch_id: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_VIEW)),
    db: Session = Depends(get_db)
):
    batch = db.query(ReconciliationBatch).options(joinedload(ReconciliationBatch.items)).filter(
        (ReconciliationBatch.id == batch_id) | (ReconciliationBatch.batch_no == batch_id)
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@reconciliation_router.post("/process")
def process_reconciliation(
    payload: ReconciliationProcessRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_RUN)),
    db: Session = Depends(get_db)
):
    if payload.bill_entries:
        entries = [{"awb": e.awb.strip(), "actual_cost": float(e.actual_cost)} for e in payload.bill_entries]
    else:
        entries = parse_bill_text(payload.raw_bill_text or "")

    if not entries:
        raise HTTPException(status_code=400, detail="No valid AWB and Cost rows found in the provider bill data.")

    provider_clean = payload.provider.lower().strip()
    provider_shipments = db.query(Shipment).filter(
        or_(func.lower(Shipment.provider_name) == provider_clean, func.lower(Shipment.courier) == provider_clean)
    ).all()

    shipment_lookup = {s.awb.strip().upper(): s for s in provider_shipments if s.awb}
    if entries and all(
        (ship := shipment_lookup.get(e["awb"].strip().upper())) is not None
        and ship.cost_reconciled and ship.actual_provider_cost is not None
        and abs(ship.actual_provider_cost - e["actual_cost"]) < 0.01
        for e in entries
    ):
        raise HTTPException(status_code=409, detail="This bill's provider costs are already saved. View the updated costs in Accounts or Reports.")
    result = match_provider_bill_entries(entries, provider_shipments)
    result["provider"] = payload.provider
    result["bill_reference"] = payload.bill_reference or f"{payload.provider} Monthly Bill"
    return result


@reconciliation_router.post("/upload-file")
async def upload_reconciliation_file(
    file: UploadFile = File(...),
    provider: str = Form(...),
    bill_reference: Optional[str] = Form(None),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_RUN)),
    db: Session = Depends(get_db)
):
    """
    Upload Excel, CSV, or searchable table PDF bills from carrier partners.
    Extracts AWB and Actual Cost, matches row-by-row, and classifies into:
    MATCHED, MISSING AWB, EXTRA AWB, WRONG AMOUNT, DUPLICATE AWB, UNMATCHED.
    """
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    entries, import_info = await run_in_threadpool(parse_bill_file, content, file.filename, parse_bill_text)

    if not entries:
        raise HTTPException(
            status_code=400,
            detail="Could not find valid AWB and Cost columns in uploaded file. Ensure columns contain AWB and Cost."
        )

    provider_clean = provider.lower().strip()
    provider_shipments = db.query(Shipment).filter(
        or_(func.lower(Shipment.provider_name) == provider_clean, func.lower(Shipment.courier) == provider_clean)
    ).all()

    result = match_provider_bill_entries(entries, provider_shipments)
    result["provider"] = provider
    result["bill_reference"] = bill_reference or file.filename or f"{provider} Uploaded Bill"
    result["filename"] = file.filename
    result["import_info"] = import_info
    return result


@reconciliation_router.post("/apply")
def apply_reconciliation(
    payload: Dict[str, Any],
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_RUN)),
    db: Session = Depends(get_db)
):
    matched_items = payload.get("matched", []) + payload.get("wrong_amount", [])
    provider = str(payload.get("provider", "")).strip()
    if not provider or not matched_items:
        raise HTTPException(status_code=400, detail="No matched shipments found to apply provider costs.")
    
    verified_items = []
    seen = set()
    provider_clean = provider.lower().strip()
    for item in matched_items:
        awb = str(item.get("awb", "")).strip()
        try:
            cost = float(item["actual_cost"])
        except (KeyError, TypeError, ValueError):
            continue
        if not awb or awb.lower() in seen or not math.isfinite(cost) or cost < 0:
            continue
        seen.add(awb.lower())
        ship = db.query(Shipment).filter(
            func.lower(Shipment.awb) == awb.lower(),
            or_(func.lower(Shipment.provider_name) == provider_clean, func.lower(Shipment.courier) == provider_clean)
        ).with_for_update().first()
        if not ship:
            continue
        current_cost = ship.actual_provider_cost if ship.cost_reconciled and ship.actual_provider_cost is not None else ship.provider_cost
        if "current_cost" in item and round(float(item["current_cost"]), 2) != round(current_cost, 2):
            raise HTTPException(status_code=409, detail=f"Shipment {awb} cost changed after preview. Please re-match the bill before applying.")
        verified_items.append((ship, round(cost, 2)))

    if not verified_items:
        raise HTTPException(status_code=400, detail="None of the matched shipments could be found in CRM for this provider.")

    if all(ship.cost_reconciled and ship.actual_provider_cost is not None
           and abs(ship.actual_provider_cost - cost) < 0.01 for ship, cost in verified_items):
        raise HTTPException(status_code=409, detail="These provider costs have already been applied. No shipments need updating.")

    predicted_total = round(sum(ship.provider_cost or 0 for ship, cost in verified_items), 2)
    actual_total = round(sum(cost for ship, cost in verified_items), 2)
    matched_count = sum(abs(cost - (ship.provider_cost or 0)) < 0.01 for ship, cost in verified_items)
    updated_count = 0

    batch_no = f"REC-{datetime.date.today().strftime('%Y%m')}-{uuid.uuid4().hex[:12].upper()}"
    batch_id = f"rec_{uuid.uuid4().hex[:16]}"

    rec_batch = ReconciliationBatch(
        id=batch_id,
        batch_no=batch_no,
        date=datetime.date.today().isoformat(),
        provider=payload.get("provider", "Aramex"),
        bill_reference=payload.get("bill_reference", f"{payload.get('provider')} Bill"),
        total_shipments=len(verified_items),
        predicted_total=predicted_total,
        actual_bill=actual_total,
        variance=round(actual_total - predicted_total, 2),
        status="Applied",
        matched_count=matched_count,
        discrepancy_count=len(verified_items) - matched_count,
        notes=f"Reconciliation applied. Updated {len(verified_items)} shipments with provider costs."
    )
    db.add(rec_batch)

    for ship, act_cost in verified_items:
        awb = ship.awb

        if ship:
            ship.actual_provider_cost = act_cost
            ship.cost_reconciled = True
            ship.gross_profit = calculate_gross_profit(
                selling_price=ship.price,
                provider_cost=ship.provider_cost,
                actual_provider_cost=act_cost,
                cost_reconciled=True
            )
            updated_count += 1

            rec_item = ReconciliationItem(
                id=f"reci_{uuid.uuid4().hex[:16]}",
                batch_id=batch_id,
                awb=awb,
                shipment_id=ship.id,
                customer_name=ship.customer_name,
                predicted_cost=ship.provider_cost,
                actual_cost=act_cost,
                variance=act_cost - ship.provider_cost,
                status="MATCHED" if abs(act_cost - (ship.provider_cost or 0)) < 0.01 else "WRONG AMOUNT"
            )
            db.add(rec_item)

    db.commit()
    cache_engine.invalidate_prefix("shipments:")
    cache_engine.invalidate_prefix("dashboard_summary")

    create_audit_log(
        db=db,
        actor_user_id=ctx["user_id"],
        actor_name=ctx["display_name"],
        event_type="reconciliation.apply",
        resource_type="reconciliation_batch",
        resource_id=batch_id,
        action="apply",
        after_data={"batch_no": batch_no, "provider": payload.get("provider"), "updated_count": updated_count, "variance": payload.get("variance")},
        ip_address=request.client.host if request.client else None
    )

    return {
        "message": "Reconciliation batch applied successfully. Real Gross Profit recalculated.",
        "batch_no": batch_no,
        "updated_count": updated_count
    }
