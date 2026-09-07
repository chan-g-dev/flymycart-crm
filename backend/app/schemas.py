# ================================================================
# FLY MY CART CRM - PYDANTIC VALIDATION SCHEMAS (app/schemas.py)
# ================================================================

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
import datetime

# --- USER & AUTH SCHEMAS ---
class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: str
    username: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    center: Optional[str] = "Main Hub (Bangalore)"
    status: Optional[str] = "Pending Approval"  # Active, Pending Approval, Suspended, Rejected
    permissions: Dict[str, bool] = {}
    is_active: bool = True
    approved_by: Optional[str] = None
    approval_date: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "operations_staff"
    center: Optional[str] = "Main Hub (Bangalore)"
    status: Optional[str] = "Pending Approval"

class UserSyncRequest(BaseModel):
    user_id: Optional[str] = None
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = "operations_staff"
    center: Optional[str] = "Main Hub (Bangalore)"

class UserApprovalAction(BaseModel):
    action: str = "approve"  # approve, reject
    role: Optional[str] = None
    center: Optional[str] = None
    notes: Optional[str] = None

class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    center: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class PendingCountOut(BaseModel):
    pending_count: int
    total_staff: int

# --- B2B COMPANY SCHEMAS ---
class B2BCompanyBase(BaseModel):
    company_name: str
    contact_person: str
    mobile: str
    email: Optional[str] = None
    gst_number: Optional[str] = None
    billing_address: Optional[str] = None
    credit_limit: float = 100000.0
    credit_period_days: int = 30
    payment_terms: str = "Net 30 Days"

class B2BCompanyCreate(B2BCompanyBase):
    pass

class B2BCompanyOut(B2BCompanyBase):
    id: str
    created_at: Optional[datetime.datetime] = None
    total_billed: Optional[float] = 0.0
    total_paid: Optional[float] = 0.0
    outstanding: Optional[float] = 0.0
    credit_utilized_percent: Optional[float] = 0.0
    status: Optional[str] = "Good Standing"

    model_config = ConfigDict(from_attributes=True)

# --- CUSTOMER SCHEMAS ---
class CustomerBase(BaseModel):
    name: str
    company: Optional[str] = None
    mobile: str
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    id_proof: Optional[str] = None
    customer_type: str = "C2C"
    source: Optional[str] = None
    center: Optional[str] = "Main Hub (Bangalore)"
    assigned_employee: Optional[str] = "Nawaz"
    credit_limit: Optional[float] = 0.0
    credit_period_days: Optional[int] = 30
    documents: Optional[List[Dict[str, Any]]] = []

class CustomerCreate(CustomerBase):
    pass

class CustomerOut(CustomerBase):
    id: str
    created_at: Optional[datetime.datetime] = None
    documents: Optional[List[Dict[str, Any]]] = []
    total_bookings: Optional[int] = 0
    total_spend: Optional[float] = 0.0
    outstanding_balance: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)

# --- SHIPMENT SCHEMAS ---
class ParcelInfo(BaseModel):
    description: Optional[str] = None
    packages_count: int = 1
    actual_weight: float = 0.0
    length: float = 0.0
    width: float = 0.0
    height: float = 0.0
    volumetric_weight: float = 0.0
    chargeable_weight: float = 0.0

class ReceiverInfo(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: str
    country: str
    zip: Optional[str] = None

class SenderInfo(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class ShipmentCreate(BaseModel):
    awb: str
    date: str
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None

    customer_id: Optional[str] = None
    customer_name: str
    customer_type: str = "C2C"
    b2b_company_id: Optional[str] = None

    center: str = "Main Hub (Bangalore)"
    employee: str = "Nawaz"

    sender: Optional[SenderInfo] = None
    receiver: ReceiverInfo
    parcel: ParcelInfo

    courier: str
    domestic_international: str = "International"
    service_type: str = "International Priority"
    provider_type: str = "postpaid"  # prepaid or postpaid
    provider_name: str
    price: float
    provider_cost: float

    payment_status: str = "Paid"
    payment_method: str = "PhonePe"
    paid_to: str = "Office QR"
    collected_by: str = "Nawaz"

    status: str = "In Transit"
    delay_reason: Optional[str] = None

class ShipmentOut(BaseModel):
    id: str
    awb: str
    date: str
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None

    customer_id: Optional[str] = None
    customer_name: str
    customer_type: str
    b2b_company_id: Optional[str] = None

    center: str
    employee: str

    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    sender_address: Optional[str] = None

    receiver_name: str
    receiver_phone: Optional[str] = None
    receiver_address: Optional[str] = None
    receiver_city: str
    receiver_country: str
    receiver_zip: Optional[str] = None

    description: Optional[str] = None
    packages_count: int
    actual_weight: float
    length: float
    width: float
    height: float
    volumetric_weight: float
    chargeable_weight: float

    courier: str
    domestic_international: str
    service_type: str
    provider_type: str
    provider_name: str
    price: float

    # Sensitive Financial Fields (masked if unauthorized)
    provider_cost: Optional[float] = None
    actual_provider_cost: Optional[float] = None
    cost_reconciled: bool
    gross_profit: Optional[float] = None

    payment_status: str
    payment_method: str
    paid_to: str
    collected_by: str
    status: str
    delay_reason: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

# --- INVOICE SCHEMAS ---
class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    b2b_company_id: Optional[str] = None
    shipment_id: Optional[str] = None
    awb: Optional[str] = None
    courier: Optional[str] = None
    service: Optional[str] = None
    description: Optional[str] = None
    amount: float
    gst: float = 0.0
    paid: float = 0.0
    date: str
    due_date: Optional[str] = None

class InvoicePaymentCreate(BaseModel):
    amount: float
    payment_method: str = "PhonePe"
    paid_to: str = "Office QR"
    collected_by: str = "Nawaz"
    reference: Optional[str] = None

class InvoiceOut(BaseModel):
    id: str
    invoice_no: str
    date: str
    due_date: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: str
    b2b_company_id: Optional[str] = None
    shipment_id: Optional[str] = None
    awb: Optional[str] = None
    courier: Optional[str] = None
    service: Optional[str] = None
    description: Optional[str] = None
    amount: float
    gst: float
    total: float
    paid: float
    balance: float
    status: str
    created_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

# --- WALLET SCHEMAS ---
class WalletRechargeCreate(BaseModel):
    wallet: str
    date: str
    amount: float
    paid_from: str
    reference: Optional[str] = None

class WalletTransactionOut(BaseModel):
    id: str
    date: str
    wallet: str
    type: str
    amount: float
    paid_from: Optional[str] = None
    reference: Optional[str] = None
    awb: Optional[str] = None
    notes: Optional[str] = None
    balance_after: float

    model_config = ConfigDict(from_attributes=True)

# --- RECONCILIATION SCHEMAS ---
class BillEntry(BaseModel):
    awb: str
    actual_cost: float
    weight: Optional[str] = None

class ReconciliationProcessRequest(BaseModel):
    provider: str
    bill_reference: Optional[str] = None
    raw_bill_text: Optional[str] = None
    bill_entries: Optional[List[BillEntry]] = None

class ReconciliationItemOut(BaseModel):
    awb: str
    shipment_id: Optional[str] = None
    customer_name: Optional[str] = None
    predicted_cost: float
    actual_cost: float
    variance: float
    status: str  # MATCHED, MISSING AWB, EXTRA AWB, WRONG AMOUNT, DUPLICATE AWB, UNMATCHED
    notes: Optional[str] = None

class ReconciliationBatchOut(BaseModel):
    id: str
    batch_no: str
    date: str
    provider: str
    bill_reference: Optional[str] = None
    total_shipments: int
    predicted_total: float
    actual_bill: float
    variance: float
    status: str
    matched_count: int
    discrepancy_count: int
    notes: Optional[str] = None
    items: Optional[List[ReconciliationItemOut]] = []

    model_config = ConfigDict(from_attributes=True)

# --- REFUND SCHEMAS ---
class RefundCreate(BaseModel):
    customer: str
    customer_id: Optional[str] = None
    awb: str
    invoice_no: Optional[str] = None
    amount: float
    reason: str
    refund_method: Optional[str] = None

class RefundOut(BaseModel):
    id: str
    customer: str
    customer_id: Optional[str] = None
    awb: str
    invoice_no: Optional[str] = None
    amount: float
    reason: str
    requested_by: str
    request_date: str
    status: str
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    refund_date: Optional[str] = None
    refund_method: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- FOLLOWUP & COMM SCHEMAS ---
class FollowupCreate(BaseModel):
    customer_id: Optional[str] = None
    customer: str
    category: str = "Customer Retention"
    due_date: str
    priority: str = "Medium"
    channel_action: str = "WhatsApp"
    notes: Optional[str] = None

class FollowupOut(BaseModel):
    id: str
    customer_id: Optional[str] = None
    customer: str
    category: str
    due_date: str
    priority: str
    status: str
    channel_action: str = "WhatsApp"
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CommunicationCreate(BaseModel):
    customer_id: Optional[str] = None
    customer: str
    date: str
    channel: str = "WhatsApp"
    message: str

class CommunicationOut(BaseModel):
    id: str
    customer_id: Optional[str] = None
    customer: str
    date: str
    channel: str
    staff: str
    message: str
    status: str

    model_config = ConfigDict(from_attributes=True)

# --- AUDIT LOG SCHEMAS ---
class AuditLogOut(BaseModel):
    id: str
    user_name: str
    entity_type: str
    entity_id: str
    action: str
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    timestamp: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# --- SUPABASE AUTH & PROFILES SPECIFICATION SCHEMAS ---
import uuid as _uuid
from pydantic import field_validator

class ProfileOut(BaseModel):
    id: Any
    email: str
    full_name: str
    role: str  # super_admin, manager, staff, viewer
    status: str  # pending, approved, rejected, suspended
    requested_role: str
    approved_by: Optional[Any] = None
    approved_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    @field_validator("id", "approved_by", mode="before")
    @classmethod
    def convert_uuid_to_str(cls, v):
        if v is not None:
            return str(v)
        return v

    model_config = ConfigDict(from_attributes=True)


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    requested_role: Optional[str] = "staff"  # manager, staff, viewer


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Dict[str, Any]
    profile: Optional[ProfileOut] = None


class ApproveUserRequest(BaseModel):
    role: str  # manager, staff, viewer, super_admin
    reason: Optional[str] = None


class RejectUserRequest(BaseModel):
    reason: Optional[str] = None


class SuspendUserRequest(BaseModel):
    reason: Optional[str] = None


class ReactivateUserRequest(BaseModel):
    reason: Optional[str] = None


class ChangeRoleRequest(BaseModel):
    role: str
    reason: Optional[str] = None


class ProfileAuditLogOut(BaseModel):
    id: Any
    profile_id: Any
    profile_email: Optional[str] = None
    profile_name: Optional[str] = None
    changed_by: Optional[Any] = None
    changed_by_name: Optional[str] = None
    changed_by_email: Optional[str] = None
    action: str
    old_role: Optional[str] = None
    new_role: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime.datetime

    @field_validator("id", "profile_id", "changed_by", mode="before")
    @classmethod
    def convert_uuid_to_str(cls, v):
        if v is not None:
            return str(v)
        return v

    model_config = ConfigDict(from_attributes=True)


class PaginatedAuditLogs(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: List[ProfileAuditLogOut]



class InviteUserRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    phone: Optional[str] = None
    role_ids: List[str] = Field(default_factory=list)
    center_ids: List[str] = Field(default_factory=list)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class SessionOut(BaseModel):
    id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime.datetime
    last_seen_at: datetime.datetime
    expires_at: datetime.datetime
    is_current: bool = False


class PermissionOut(BaseModel):
    id: str
    resource: str
    action: str
    code: str
    module: str
    is_financial: bool
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoleOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    permissions: List[Dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RoleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[Dict[str, str]] = Field(default_factory=list)  # [{"permission_id": "uuid", "scope": "center"}]


class RoleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class RolePermissionsUpdateRequest(BaseModel):
    permissions: List[Dict[str, str]]  # [{"permission_id": "uuid", "scope": "center"}]


class UserRolesUpdateRequest(BaseModel):
    role_ids: List[str]


class UserCentersUpdateRequest(BaseModel):
    center_ids: List[str]
    scope: Optional[str] = "operate"


# --- BOOKING REQUEST & QUOTE SCHEMAS ---
class BookingParcelCreate(BaseModel):
    package_number: int = 1
    description: Optional[str] = None
    length: float = 0.0
    width: float = 0.0
    height: float = 0.0
    actual_weight: float = 0.0
    volumetric_weight: float = 0.0
    chargeable_weight: float = 0.0

class BookingParcelOut(BookingParcelCreate):
    id: str
    booking_request_id: str

    model_config = ConfigDict(from_attributes=True)

class BookingRequestCreate(BaseModel):
    shipment_type: str = "International"  # Domestic, International
    sender_name: str
    sender_phone: str
    sender_email: Optional[str] = None
    sender_address: str
    sender_city: Optional[str] = None
    sender_state: Optional[str] = None
    sender_zip: Optional[str] = None
    sender_country: str = "India"

    receiver_name: str
    receiver_phone: str
    receiver_email: Optional[str] = None
    receiver_address: str
    receiver_city: str
    receiver_state: Optional[str] = None
    receiver_zip: Optional[str] = None
    receiver_country: str

    parcel_description: Optional[str] = None
    packages_count: int = 1
    actual_weight: float = 0.0
    length: float = 0.0
    width: float = 0.0
    height: float = 0.0

    preferred_service: Optional[str] = "International Priority"
    pickup_date: Optional[str] = None
    pickup_address: Optional[str] = None
    special_instructions: Optional[str] = None
    documents: Optional[List[Any]] = []
    parcels: Optional[List[BookingParcelCreate]] = []

class BookingQuoteCreate(BaseModel):
    quoted_amount: float
    quoted_courier: Optional[str] = None
    quoted_notes: Optional[str] = None

class BookingQuoteResponse(BaseModel):
    action: str  # "accept" or "reject"
    rejection_reason: Optional[str] = None

class BookingConvertToShipmentRequest(BaseModel):
    awb: str
    courier: str
    service_type: str = "International Priority"
    provider_name: str
    provider_type: str = "postpaid"  # prepaid, postpaid
    price: float
    provider_cost: float
    center: Optional[str] = "Main Hub (Bangalore)"
    employee: Optional[str] = "Nawaz"
    payment_status: Optional[str] = "Unpaid"
    payment_method: Optional[str] = "PhonePe"
    paid_to: Optional[str] = "Office QR"
    collected_by: Optional[str] = "Nawaz"

class BookingRequestOut(BaseModel):
    id: str
    request_no: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_type: str
    b2b_company_id: Optional[str] = None
    shipment_type: str

    sender_name: str
    sender_phone: str
    sender_email: Optional[str] = None
    sender_address: str
    sender_city: Optional[str] = None
    sender_state: Optional[str] = None
    sender_zip: Optional[str] = None
    sender_country: str

    receiver_name: str
    receiver_phone: str
    receiver_email: Optional[str] = None
    receiver_address: str
    receiver_city: str
    receiver_state: Optional[str] = None
    receiver_zip: Optional[str] = None
    receiver_country: str

    parcel_description: Optional[str] = None
    packages_count: int
    actual_weight: float
    length: float
    width: float
    height: float
    volumetric_weight: float
    chargeable_weight: float

    preferred_service: Optional[str] = None
    pickup_date: Optional[str] = None
    pickup_address: Optional[str] = None
    special_instructions: Optional[str] = None
    documents: List[Any] = []

    status: str
    quoted_amount: Optional[float] = None
    quoted_courier: Optional[str] = None
    quoted_notes: Optional[str] = None
    quoted_by: Optional[str] = None
    quoted_at: Optional[datetime.datetime] = None
    quote_accepted_at: Optional[datetime.datetime] = None
    quote_rejected_reason: Optional[str] = None

    converted_shipment_id: Optional[str] = None
    converted_awb: Optional[str] = None
    converted_by: Optional[str] = None
    converted_at: Optional[datetime.datetime] = None

    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None
    parcels: Optional[List[BookingParcelOut]] = []

    model_config = ConfigDict(from_attributes=True)


# --- CUSTOMER PORTAL SCHEMAS (Strict Financial Masking) ---
class CustomerTrackingEventOut(BaseModel):
    id: str
    timestamp: datetime.datetime
    status: str
    location: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CustomerPortalShipmentOut(BaseModel):
    id: str
    awb: str
    date: str
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None

    receiver_name: str
    receiver_phone: Optional[str] = None
    receiver_city: str
    receiver_country: str
    receiver_zip: Optional[str] = None

    description: Optional[str] = None
    packages_count: int
    actual_weight: float
    volumetric_weight: float
    chargeable_weight: float

    courier: str
    domestic_international: str
    service_type: str
    price: float
    payment_status: str

    status: str
    delay_reason: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    tracking_events: List[CustomerTrackingEventOut] = []

    model_config = ConfigDict(from_attributes=True)

class CustomerSignupRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    account_type: str = "C2C"  # C2C, B2C, B2B
    company_name: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None



