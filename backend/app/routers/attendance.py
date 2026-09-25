# ================================================================
# FLY MY CART CRM - ATTENDANCE & STAFF TIMINGS ROUTER (routers/attendance.py)
# ================================================================

import datetime
import uuid
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import AttendanceRecord, User, UserProfile, SystemSettings
from app.business_dates import business_today, business_now
from app.dependencies import require_permission, get_current_session_context
from app.permissions import PermissionCode
from app.auth import create_audit_log

attendance_router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

def get_all_active_staff_names(db: Session) -> List[str]:
    """Returns unique list of verified operational staff names directly from active UserProfiles (excluding super admins)."""
    names = set()
    try:
        profiles = db.query(UserProfile.display_name, UserProfile.role).filter(UserProfile.status == "active").all()
        for u, r in profiles:
            if u and u.strip() and r != "super_admin" and u.strip().lower() not in ["fly my cart"]:
                names.add(u.strip())
    except Exception:
        pass
    try:
        if not names:
            users = db.query(User.name, User.role).filter(User.is_active == True).all()
            for u, r in users:
                if u and u.strip() and r != "super_admin" and u.strip().lower() not in ["fly my cart"]:
                    names.add(u.strip())
    except Exception:
        pass
    try:
        if not names:
            records = db.query(AttendanceRecord.staff_name).distinct().all()
            for r in records:
                if r[0] and r[0].strip() and r[0].strip().lower() not in ["fly my cart", "gangabathina chanakya", "admin"]:
                    names.add(r[0].strip())
    except Exception:
        pass


    return sorted(list(names))


def parse_time_to_minutes(time_str: str) -> Optional[int]:
    """Converts 12-hour or 24-hour time string (e.g., '09:17 AM', '09:17:28 AM', or '18:49') to total minutes from midnight."""
    if not time_str or time_str == "—" or time_str == "-":
        return None
    time_str = time_str.strip().upper()
    try:
        match_12 = re.match(r"(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?", time_str)
        if match_12:
            hours = int(match_12.group(1))
            minutes = int(match_12.group(2))
            meridiem = match_12.group(3)
            if meridiem:
                if meridiem == "PM" and hours != 12:
                    hours += 12
                elif meridiem == "AM" and hours == 12:
                    hours = 0
            return hours * 60 + minutes
    except Exception:
        pass
    return None


def format_minutes_to_hours_str(minutes: Optional[int]) -> str:
    """Formats minutes into 'Xh Ym' string."""
    if minutes is None or minutes <= 0:
        return "0h 0m"
    h = minutes // 60
    m = minutes % 60
    return f"{h}h {m}m"


def format_diff_str(diff_minutes: int) -> str:
    """Formats difference into signed string, e.g., '+0h 25m' or '-0h 21m'."""
    sign = "+" if diff_minutes >= 0 else "-"
    abs_m = abs(diff_minutes)
    h = abs_m // 60
    m = abs_m % 60
    return f"{sign}{h}h {m}m" if h > 0 else f"{sign}{m}m"


class PunchRequest(BaseModel):
    staff_name: str = Field(min_length=1, max_length=150)
    event: str = Field(pattern="^(LOGIN|LOGOUT|LUNCH START|LUNCH END|BREAK START|BREAK END)$")
    date: Optional[str] = None
    time: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None


@attendance_router.get("/staff-list")
def get_staff_list(
    ctx: Dict[str, Any] = Depends(require_permission("attendance.view")),
    db: Session = Depends(get_db)
):
    """Returns list of staff members based on permission scope."""
    if ctx.get("permissions", {}).get("attendance.view") is False:
        raise HTTPException(403, "Access to attendance has been restricted by Super Admin.")
    is_admin = ctx.get("is_super_admin") or bool(ctx.get("permissions", {}).get("attendance.manage")) or ctx.get("permissions", {}).get("attendance.view") == "all"
    if not is_admin:
        staff = [ctx.get("display_name") or "Staff"]
    else:
        staff = get_all_active_staff_names(db)
    return {"staff": staff, "total_count": len(staff)}


@attendance_router.get("/summary")
def get_attendance_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    staff_name: Optional[str] = None,
    expected_work_min: int = Query(480, ge=60, le=1440),
    grace_period_min: int = Query(15, ge=0, le=120),
    expected_login: str = Query("09:00 AM"),
    expected_logout: str = Query("06:00 PM"),
    ctx: Dict[str, Any] = Depends(require_permission("attendance.view")),
    db: Session = Depends(get_db)
):
    """Calculates attendance summary KPIs, present/absent counts, and staff summary cards."""
    if ctx.get("permissions", {}).get("attendance.view") is False:
        raise HTTPException(403, "Access to attendance has been restricted by Super Admin.")
    start_date = date_from or business_today().isoformat()
    end_date = date_to or start_date
    if start_date > end_date:
        start_date, end_date = end_date, start_date

    # Determine unique calendar days in range
    try:
        d_start = datetime.date.fromisoformat(start_date)
        d_end = datetime.date.fromisoformat(end_date)
        days_count = (d_end - d_start).days + 1
    except Exception:
        d_start = business_today()
        d_end = business_today()
        days_count = 1

    is_admin = ctx.get("is_super_admin") or bool(ctx.get("permissions", {}).get("attendance.manage")) or ctx.get("permissions", {}).get("attendance.view") == "all"
    user_display = ctx.get("display_name") or "Staff"

    if not is_admin:
        all_staff = [user_display]
    else:
        all_staff = [staff_name] if (staff_name and staff_name != "All Staff" and not staff_name.startswith("All Staff")) else get_all_active_staff_names(db)

    total_staff_count = len(all_staff)
    total_staff_days = total_staff_count * days_count

    # Fetch records in range
    query = db.query(AttendanceRecord).filter(AttendanceRecord.date.between(start_date, end_date))
    if not is_admin:
        query = query.filter(AttendanceRecord.staff_name == user_display)
    elif staff_name and staff_name != "All Staff" and not staff_name.startswith("All Staff"):
        query = query.filter(AttendanceRecord.staff_name == staff_name)
    records = query.order_by(AttendanceRecord.date, AttendanceRecord.time).all()

    # Group records by (staff_name, date)
    grouped = {}
    for r in records:
        key = (r.staff_name, r.date)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(r)

    exp_login_min = parse_time_to_minutes(expected_login) or 540  # 9:00 AM = 540 min
    exp_logout_min = parse_time_to_minutes(expected_logout) or 1080 # 6:00 PM = 1080 min

    present_days = 0
    late_days = 0
    on_time_days = 0
    no_logout_count = 0
    total_work_minutes_all = 0

    staff_metrics = {name: {"present": 0, "absent": 0, "total_work_min": 0, "late": 0, "on_time": 0} for name in all_staff}

    for s_name in all_staff:
        for offset in range(days_count):
            day_str = (d_start + datetime.timedelta(days=offset)).isoformat()
            key = (s_name, day_str)
            day_events = grouped.get(key, [])

            if not day_events:
                staff_metrics[s_name]["absent"] += 1
                continue

            # Present on this day
            present_days += 1
            staff_metrics[s_name]["present"] += 1

            # Identify login and logout
            logins = [e for e in day_events if e.event == "LOGIN"]
            logouts = [e for e in day_events if e.event == "LOGOUT"]

            login_min = parse_time_to_minutes(logins[0].time) if logins else parse_time_to_minutes(day_events[0].time)
            logout_min = parse_time_to_minutes(logouts[-1].time) if logouts else None

            # Calculate work duration
            work_min = 0
            if login_min is not None and logout_min is not None and logout_min > login_min:
                work_min = logout_min - login_min
                # Deduct lunch break if present
                lunch_starts = [e for e in day_events if e.event == "LUNCH START"]
                lunch_ends = [e for e in day_events if e.event == "LUNCH END"]
                if lunch_starts and lunch_ends:
                    l_start = parse_time_to_minutes(lunch_starts[0].time)
                    l_end = parse_time_to_minutes(lunch_ends[-1].time)
                    if l_start and l_end and l_end > l_start:
                        work_min = max(0, work_min - (l_end - l_start))
                # Deduct break intervals if present
                break_starts = [e for e in day_events if e.event == "BREAK START"]
                break_ends = [e for e in day_events if e.event == "BREAK END"]
                if break_starts and break_ends:
                    b_start = parse_time_to_minutes(break_starts[0].time)
                    b_end = parse_time_to_minutes(break_ends[-1].time)
                    if b_start and b_end and b_end > b_start:
                        work_min = max(0, work_min - (b_end - b_start))
            elif not logouts:
                no_logout_count += 1

            staff_metrics[s_name]["total_work_min"] += work_min
            total_work_minutes_all += work_min

            # Check punctuality
            is_late = False
            if login_min is not None:
                if login_min > (exp_login_min + grace_period_min):
                    is_late = True

            if is_late:
                late_days += 1
                staff_metrics[s_name]["late"] += 1
            elif work_min >= expected_work_min or (logout_min is not None and logout_min >= exp_logout_min):
                on_time_days += 1
                staff_metrics[s_name]["on_time"] += 1

    absent_days = max(0, total_staff_days - present_days)
    avg_work_min = int(total_work_minutes_all / present_days) if present_days > 0 else 0

    staff_summaries = []
    for name in all_staff:
        data = staff_metrics[name]
        p_count = data["present"]
        a_count = data["absent"]
        avg_min = int(data["total_work_min"] / p_count) if p_count > 0 else 0
        h_str = f"{avg_min // 60}h" if (avg_min % 60 == 0) else f"{avg_min // 60}h {avg_min % 60}m"
        if p_count == 0:
            st = "Absent"
        elif data.get("late", 0) > 0:
            st = f"{data['late']} Late"
        else:
            st = "All good"

        staff_summaries.append({
            "staff_name": name,
            "present_days": p_count,
            "absent_days": a_count,
            "avg_work_str": h_str,
            "status": st
        })

    return {
        "date_from": start_date,
        "date_to": end_date,
        "days_count": days_count,
        "total_staff_count": total_staff_count,
        "total_staff_days": total_staff_days,
        "present_days": present_days,
        "absent_days": absent_days,
        "late_days": late_days,
        "on_time_days": on_time_days,
        "avg_work_time_str": format_minutes_to_hours_str(avg_work_min),
        "expected_work_str": format_minutes_to_hours_str(expected_work_min),
        "no_logout_count": no_logout_count,
        "staff_summaries": staff_summaries
    }


@attendance_router.get("/events")
def get_attendance_events(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    staff_name: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    ctx: Dict[str, Any] = Depends(require_permission("attendance.view")),
    db: Session = Depends(get_db)
):
    """Fetches event stream log for Attendance Log tab."""
    if ctx.get("permissions", {}).get("attendance.view") is False:
        raise HTTPException(403, "Access to attendance has been restricted by Super Admin.")
    is_admin = ctx.get("is_super_admin") or bool(ctx.get("permissions", {}).get("attendance.manage")) or ctx.get("permissions", {}).get("attendance.view") == "all"
    user_display = ctx.get("display_name") or "Staff"

    query = db.query(AttendanceRecord)
    if date_from:
        query = query.filter(AttendanceRecord.date >= date_from)
    if date_to:
        query = query.filter(AttendanceRecord.date <= date_to)
    
    if not is_admin:
        query = query.filter(AttendanceRecord.staff_name == user_display)
    elif staff_name and staff_name != "All Staff" and not staff_name.startswith("All Staff"):
        query = query.filter(AttendanceRecord.staff_name == staff_name)

    if search:
        s = f"%{search.lower().strip()}%"
        query = query.filter(
            or_(
                func.lower(AttendanceRecord.staff_name).like(s),
                func.lower(AttendanceRecord.event).like(s),
                func.lower(AttendanceRecord.time).like(s)
            )
        )

    total_count = query.count()
    records = query.order_by(AttendanceRecord.date.desc(), desc(AttendanceRecord.timestamp), desc(AttendanceRecord.id)).offset(offset).limit(limit).all()

    return {
        "total_count": total_count,
        "events": [
            {
                "id": r.id,
                "staff_name": r.staff_name,
                "date": r.date,
                "event": r.event,
                "time": r.time,
                "photo_url": r.photo_url,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in records
        ]
    }


@attendance_router.get("/daily-breakdown")
def get_daily_breakdown(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    staff_name: Optional[str] = None,
    search: Optional[str] = None,
    expected_work_min: int = Query(480, ge=60, le=1440),
    grace_period_min: int = Query(15, ge=0, le=120),
    expected_login: str = Query("09:00 AM"),
    expected_logout: str = Query("06:00 PM"),
    limit: int = Query(300, ge=1, le=1000),
    ctx: Dict[str, Any] = Depends(require_permission("attendance.view")),
    db: Session = Depends(get_db)
):
    """Calculates daily login/logout time breakdown, work duration, differences and status."""
    if ctx.get("permissions", {}).get("attendance.view") is False:
        raise HTTPException(403, "Access to attendance has been restricted by Super Admin.")
    start_date = date_from or business_today().isoformat()
    end_date = date_to or start_date
    if start_date > end_date:
        start_date, end_date = end_date, start_date

    exp_login_min = parse_time_to_minutes(expected_login) or 540
    exp_logout_min = parse_time_to_minutes(expected_logout) or 1080

    is_admin = ctx.get("is_super_admin") or bool(ctx.get("permissions", {}).get("attendance.manage")) or ctx.get("permissions", {}).get("attendance.view") == "all"
    user_display = ctx.get("display_name") or "Staff"

    query = db.query(AttendanceRecord).filter(AttendanceRecord.date.between(start_date, end_date))
    if not is_admin:
        query = query.filter(AttendanceRecord.staff_name == user_display)
    elif staff_name and staff_name != "All Staff" and not staff_name.startswith("All Staff"):
        query = query.filter(AttendanceRecord.staff_name == staff_name)
    records = query.order_by(AttendanceRecord.date.desc(), AttendanceRecord.timestamp.asc()).all()

    grouped = {}
    for r in records:
        key = (r.staff_name, r.date)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(r)

    rows = []
    for (s_name, date_str), events in grouped.items():
        if search:
            s_clean = search.lower().strip()
            if s_clean not in s_name.lower() and s_clean not in date_str:
                continue

        logins = [e for e in events if e.event == "LOGIN"]
        logouts = [e for e in events if e.event == "LOGOUT"]

        login_time = logins[0].time if logins else events[0].time
        logout_time = logouts[-1].time if logouts else "—"

        login_min = parse_time_to_minutes(login_time)
        logout_min = parse_time_to_minutes(logout_time)

        # Login diff
        login_diff_str = "—"
        login_status = "on_time"
        if login_min is not None:
            diff_l = login_min - exp_login_min
            if diff_l <= grace_period_min:
                login_diff_str = "✓ on time"
                login_status = "on_time"
            else:
                login_diff_str = f"+{diff_l}m late"
                login_status = "late"

        # Logout diff
        logout_diff_str = "—"
        logout_status = "none"
        if logout_min is not None:
            diff_o = logout_min - exp_logout_min
            if diff_o >= -grace_period_min:
                logout_diff_str = "✓ on time"
                logout_status = "on_time"
            else:
                logout_diff_str = f"-{abs(diff_o)}m early"
                logout_status = "early"

        # Work duration
        work_min = 0
        work_diff_str = "—"
        status_label = "No Logout"

        if login_min is not None and logout_min is not None and logout_min > login_min:
            work_min = logout_min - login_min
            # Deduct lunch
            lunch_starts = [e for e in events if e.event == "LUNCH START"]
            lunch_ends = [e for e in events if e.event == "LUNCH END"]
            if lunch_starts and lunch_ends:
                l_s = parse_time_to_minutes(lunch_starts[0].time)
                l_e = parse_time_to_minutes(lunch_ends[-1].time)
                if l_s and l_e and l_e > l_s:
                    work_min = max(0, work_min - (l_e - l_s))

            # Deduct breaks
            break_starts = [e for e in events if e.event == "BREAK START"]
            break_ends = [e for e in events if e.event == "BREAK END"]
            if break_starts and break_ends:
                b_s = parse_time_to_minutes(break_starts[0].time)
                b_e = parse_time_to_minutes(break_ends[-1].time)
                if b_s and b_e and b_e > b_s:
                    work_min = max(0, work_min - (b_e - b_s))

            diff_w = work_min - expected_work_min
            work_diff_str = format_diff_str(diff_w)

            if work_min >= expected_work_min or login_status == "on_time":
                status_label = "On Time"
            elif work_min < expected_work_min * 0.6:
                status_label = "Half Day"
            else:
                status_label = "Late"
        elif logout_time == "—":
            status_label = "No Logout"

        rows.append({
            "staff_name": s_name,
            "date": date_str,
            "login_time": login_time,
            "logout_time": logout_time,
            "work_time_str": format_minutes_to_hours_str(work_min),
            "expected_str": format_minutes_to_hours_str(expected_work_min),
            "login_diff": login_diff_str,
            "login_status": login_status,
            "logout_diff": logout_diff_str,
            "logout_status": logout_status,
            "work_diff": work_diff_str,
            "status": status_label
        })

    # Sort rows by date desc, staff_name asc
    rows.sort(key=lambda x: (x["date"], x["staff_name"]), reverse=True)

    return {
        "total_entries": len(rows),
        "entries": rows[:limit]
    }


@attendance_router.post("/punch", status_code=201)
def record_punch(
    payload: PunchRequest,
    request: Request,
    ctx: Dict[str, Any] = Depends(require_permission("attendance.punch")),
    db: Session = Depends(get_db)
):
    """Records punch event (LOGIN, LOGOUT, LUNCH START, LUNCH END, BREAK START, BREAK END)."""
    if ctx.get("permissions", {}).get("attendance.punch") is False:
        raise HTTPException(403, "Recording attendance punches has been restricted by Super Admin.")
    ist_now = business_now()
    now_utc = datetime.datetime.utcnow()
    date_str = payload.date or ist_now.strftime("%Y-%m-%d")
    time_str = payload.time or ist_now.strftime("%I:%M:%S %p")

    # Regular staff can only punch for themselves unless they have attendance.manage or is_super_admin
    is_admin = ctx.get("is_super_admin") or bool(ctx.get("permissions", {}).get("attendance.manage"))
    staff_name = payload.staff_name.strip() if is_admin else (ctx.get("display_name") or payload.staff_name.strip())

    record = AttendanceRecord(
        id=f"att_{uuid.uuid4().hex[:16]}",
        user_id=ctx.get("user_id"),
        staff_name=staff_name,
        date=date_str,
        event=payload.event,
        time=time_str,
        photo_url=payload.photo_url,
        notes=payload.notes,
        ip_address=request.client.host if request.client else None,
        timestamp=now_utc
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    create_audit_log(
        db=db,
        actor_user_id=ctx.get("user_id"),
        actor_name=ctx.get("display_name"),
        event_type="attendance.punch",
        resource_type="attendance_record",
        resource_id=record.id,
        action="punch",
        after_data={"staff": record.staff_name, "event": record.event, "date": record.date, "time": record.time},
        ip_address=request.client.host if request.client else None
    )

    return {
        "id": record.id,
        "message": f"{payload.event} recorded successfully for {staff_name} at {time_str}."
    }
