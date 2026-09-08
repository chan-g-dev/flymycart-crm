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
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_

from app.database import get_db
from app.models import Shipment, ReconciliationBatch, ReconciliationItem, AuditLog
from app.schemas import ReconciliationProcessRequest, ReconciliationBatchOut
from app.finance_engine import calculate_gross_profit, match_provider_bill_entries
from app.auth import create_audit_log
from app.dependencies import require_permission
from app.permissions import PermissionCode

reconciliation_router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])

@reconciliation_router.get("/batches", response_model=List[ReconciliationBatchOut])
def get_reconciliation_batches(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_VIEW)),
    db: Session = Depends(get_db)
):
    query = db.query(ReconciliationBatch).order_by(desc(ReconciliationBatch.created_at), ReconciliationBatch.id)
    response.headers["X-Total-Count"] = str(query.count())
    return query.limit(limit).offset(offset).all()

@reconciliation_router.get("/batches/{batch_id}", response_model=ReconciliationBatchOut)
def get_reconciliation_batch(
    batch_id: str,
    ctx: Dict[str, Any] = Depends(require_permission(PermissionCode.RECONCILIATION_VIEW)),
    db: Session = Depends(get_db)
):
    batch = db.query(ReconciliationBatch).filter((ReconciliationBatch.id == batch_id) | (ReconciliationBatch.batch_no == batch_id)).first()
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
    entries = []
    if payload.bill_entries:
        entries = [{"awb": e.awb.strip(), "actual_cost": float(e.actual_cost)} for e in payload.bill_entries]
    elif payload.raw_bill_text:
        lines = [l.strip() for l in payload.raw_bill_text.splitlines() if l.strip()]
        for l in lines:
            parts = re.split(r'[\t,;\s]+', l)
            if len(parts) >= 2:
                awb = parts[0]
                cost = next((p for p in parts[1:] if re.match(r'^\d+(\.\d+)?$', p.replace('₹', '').replace(',', ''))), None)
                if awb and cost and 'awb' not in awb.lower():
                    entries.append({"awb": awb, "actual_cost": float(cost.replace('₹', '').replace(',', ''))})

    if not entries:
        raise HTTPException(status_code=400, detail="No valid AWB and Cost rows found in the provider bill data.")

    provider_shipments = db.query(Shipment).filter(
        or_(
            func.lower(Shipment.courier) == payload.provider.lower().strip(),
            func.lower(Shipment.provider_name) == payload.provider.lower().strip()
        )
    ).all()

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
    Upload CSV/billing file from carrier partner (Aramex, Blue Dart, ICL, BRV, etc.).
    Extracts AWB and Actual Cost, matches row-by-row, and classifies into:
    MATCHED, MISSING AWB, EXTRA AWB, WRONG AMOUNT, DUPLICATE AWB, UNMATCHED.
    """
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    entries = []
    # Try CSV reader first
    try:
        reader = csv.reader(io.StringIO(text))
        for row in reader:
            if not row:
                continue
            # Find candidate AWB and candidate cost in the row
            row_str = " ".join(row).strip()
            parts = [p.strip() for p in row if p.strip()]
            if len(parts) >= 2:
                awb = parts[0]
                cost_candidate = None
                for p in parts[1:]:
                    cleaned = p.replace("₹", "").replace(",", "").replace("$", "").strip()
                    if re.match(r'^\d+(\.\d+)?$', cleaned):
                        cost_candidate = float(cleaned)
                        break
                if awb and cost_candidate is not None and "awb" not in awb.lower():
                    entries.append({"awb": awb, "actual_cost": cost_candidate})
    except Exception:
        pass

    # Fallback to line-by-line regex if CSV produced no entries
    if not entries:
        for line in text.splitlines():
            parts = re.split(r'[\t,;\s]+', line.strip())
            if len(parts) >= 2:
                awb = parts[0]
                cost = next((p for p in parts[1:] if re.match(r'^\d+(\.\d+)?$', p.replace('₹', '').replace(',', ''))), None)
                if awb and cost and 'awb' not in awb.lower():
                    entries.append({"awb": awb, "actual_cost": float(cost.replace('₹', '').replace(',', ''))})

    if not entries:
        raise HTTPException(
            status_code=400,
            detail="Could not find valid AWB and Cost columns in uploaded file. Ensure columns contain AWB and Cost."
        )

    provider_shipments = db.query(Shipment).filter(
        or_(
            func.lower(Shipment.courier) == provider.lower().strip(),
            func.lower(Shipment.provider_name) == provider.lower().strip()
        )
    ).all()

    result = match_provider_bill_entries(entries, provider_shipments)
    result["provider"] = provider
    result["bill_reference"] = bill_reference or file.filename or f"{provider} Uploaded Bill"
    result["filename"] = file.filename
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
        raise HTTPException(status_code=400, detail="Provider and matched bill items are required")
    verified_items = []
    seen = set()
    for item in matched_items:
        awb = str(item.get("awb", "")).strip()
        try:
            cost = float(item["actual_cost"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid provider cost")
        if not awb or awb.lower() in seen or not math.isfinite(cost) or cost < 0:
            raise HTTPException(status_code=400, detail="Bill contains an invalid cost or duplicate AWB")
        seen.add(awb.lower())
        ship = db.query(Shipment).filter(func.lower(Shipment.awb) == awb.lower(),
            func.lower(Shipment.provider_name) == provider.lower()).first()
        if not ship:
            raise HTTPException(status_code=400, detail=f"AWB {awb} does not belong to this provider")
        verified_items.append((ship, round(cost, 2)))
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
        total_shipments=len(matched_items),
        predicted_total=predicted_total,
        actual_bill=actual_total,
        variance=round(actual_total - predicted_total, 2),
        status="Applied",
        matched_count=matched_count,
        discrepancy_count=len(verified_items) - matched_count,
        notes=f"Reconciliation applied. Updated {len(matched_items)} shipments with actual provider costs."
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
