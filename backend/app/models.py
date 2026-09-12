# ================================================================
# FLY MY CART CRM - SQLALCHEMY DATA MODELS (app/models.py)
# ================================================================

import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, default=lambda: f"u_{uuid.uuid4().hex[:16]}")
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    role = Column(String(50), default="operations_staff")  # super_admin, operations_staff, counter_staff
    center = Column(String(100), default="Main Hub (Bangalore)")
    status = Column(String(50), default="Pending Approval")  # Active, Pending Approval, Suspended, Rejected
    permissions = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=True)
    approved_by = Column(String(100), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(50), primary_key=True, default=lambda: f"aud_{uuid.uuid4().hex[:16]}")
    user_id = Column(String(50), nullable=True)
    user_name = Column(String(100), default="System")
    event_type = Column(String(100), default="audit")
    entity_type = Column(String(50), nullable=False, index=True)  # Shipment, Invoice, Wallet, Refund, Reconciliation
    entity_id = Column(String(50), nullable=True, index=True)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, RECONCILE, REFUND, RECHARGE
    result = Column(String(20), default="success")
    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(60), nullable=True)
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    @property
    def actor_user_id(self):
        return self.user_id

    @actor_user_id.setter
    def actor_user_id(self, v):
        self.user_id = v

    @property
    def actor_name(self):
        return self.user_name

    @actor_name.setter
    def actor_name(self, v):
        self.user_name = v


class B2BCompany(Base):
    __tablename__ = "b2b_companies"

    id = Column(String(50), primary_key=True, default=lambda: f"b2b_{uuid.uuid4().hex[:16]}")
    company_name = Column(String(150), unique=True, nullable=False, index=True)
    contact_person = Column(String(100), nullable=False)
    mobile = Column(String(20), nullable=False, index=True)
    email = Column(String(100), nullable=True)
    gst_number = Column(String(50), nullable=True)
    billing_address = Column(Text, nullable=True)
    credit_limit = Column(Float, default=100000.0)
    credit_period_days = Column(Integer, default=30)  # 30, 40, 50, 60, 90
    payment_terms = Column(String(100), default="Net 30 Days")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    shipments = relationship("Shipment", back_populates="b2b_company_rel")
    invoices = relationship("Invoice", back_populates="b2b_company_rel")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(50), primary_key=True, default=lambda: f"cust_{uuid.uuid4().hex[:16]}")
    name = Column(String(100), nullable=False, index=True)
    company = Column(String(100), nullable=True)
    mobile = Column(String(20), nullable=False, index=True)
    whatsapp = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    id_proof = Column(String(100), nullable=True)
    customer_type = Column(String(10), default="C2C", index=True)  # C2C, B2C, B2B
    source = Column(String(100), nullable=True)
    center = Column(String(100), default="Main Hub (Bangalore)")
    assigned_employee = Column(String(100), default="Nawaz")
    credit_limit = Column(Float, default=0.0)
    credit_period_days = Column(Integer, default=30)
    documents = Column(JSON, default=list)
    b2b_company_id = Column(String(50), ForeignKey("b2b_companies.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_customers_center_created", "center", "created_at"),
        Index("idx_customers_center_type", "center", "customer_type"),
    )

    shipments = relationship("Shipment", back_populates="customer_rel", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="customer_rel", cascade="all, delete-orphan")
    followups = relationship("Followup", back_populates="customer_rel", cascade="all, delete-orphan")
    booking_requests = relationship("BookingRequest", back_populates="customer_rel", cascade="all, delete-orphan")
    b2b_company_rel = relationship("B2BCompany", foreign_keys=[b2b_company_id])


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(String(50), primary_key=True, default=lambda: f"req_{uuid.uuid4().hex[:16]}")
    request_no = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=True, index=True)
    customer_name = Column(String(100), nullable=False, index=True)
    customer_phone = Column(String(20), nullable=True)
    customer_email = Column(String(100), nullable=True)
    customer_type = Column(String(10), default="C2C", index=True)  # C2C, B2C, B2B
    b2b_company_id = Column(String(50), ForeignKey("b2b_companies.id"), nullable=True, index=True)

    shipment_type = Column(String(20), default="International")  # Domestic, International

    # Sender details
    sender_name = Column(String(100), nullable=False)
    sender_phone = Column(String(20), nullable=False)
    sender_email = Column(String(100), nullable=True)
    sender_address = Column(Text, nullable=False)
    sender_city = Column(String(100), nullable=True)
    sender_state = Column(String(100), nullable=True)
    sender_zip = Column(String(20), nullable=True)
    sender_country = Column(String(100), default="India")

    # Receiver details
    receiver_name = Column(String(100), nullable=False)
    receiver_phone = Column(String(20), nullable=False)
    receiver_email = Column(String(100), nullable=True)
    receiver_address = Column(Text, nullable=False)
    receiver_city = Column(String(100), nullable=False)
    receiver_state = Column(String(100), nullable=True)
    receiver_zip = Column(String(20), nullable=True)
    receiver_country = Column(String(100), nullable=False)

    # Parcel & weights
    parcel_description = Column(Text, nullable=True)
    packages_count = Column(Integer, default=1)
    actual_weight = Column(Float, default=0.0)
    length = Column(Float, default=0.0)
    width = Column(Float, default=0.0)
    height = Column(Float, default=0.0)
    volumetric_weight = Column(Float, default=0.0)
    chargeable_weight = Column(Float, default=0.0)

    # Pickup & Service details
    preferred_service = Column(String(100), default="International Priority")
    pickup_date = Column(String(20), nullable=True)
    pickup_address = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)
    documents = Column(JSON, default=list)

    # Status: Draft, Submitted, Under Review, Quote Sent, Accepted, Rejected, Converted to Shipment, Cancelled
    status = Column(String(30), default="Submitted", index=True)

    # Quote fields
    quoted_amount = Column(Float, nullable=True)
    quoted_courier = Column(String(50), nullable=True)
    quoted_notes = Column(Text, nullable=True)
    quoted_by = Column(String(100), nullable=True)
    quoted_at = Column(DateTime, nullable=True)
    quote_accepted_at = Column(DateTime, nullable=True)
    quote_rejected_reason = Column(Text, nullable=True)

    # Conversion fields
    converted_shipment_id = Column(String(50), nullable=True)
    converted_awb = Column(String(50), nullable=True, index=True)
    converted_by = Column(String(100), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    customer_rel = relationship("Customer", back_populates="booking_requests")
    b2b_company_rel = relationship("B2BCompany", foreign_keys=[b2b_company_id])
    parcels = relationship("BookingParcel", back_populates="booking_request_rel", cascade="all, delete-orphan")


class BookingParcel(Base):
    __tablename__ = "booking_parcels"

    id = Column(String(50), primary_key=True, default=lambda: f"bp_{uuid.uuid4().hex[:16]}")
    booking_request_id = Column(String(50), ForeignKey("booking_requests.id"), nullable=False, index=True)
    package_number = Column(Integer, default=1)
    description = Column(String(200), nullable=True)
    length = Column(Float, default=0.0)
    width = Column(Float, default=0.0)
    height = Column(Float, default=0.0)
    actual_weight = Column(Float, default=0.0)
    volumetric_weight = Column(Float, default=0.0)
    chargeable_weight = Column(Float, default=0.0)

    booking_request_rel = relationship("BookingRequest", back_populates="parcels")


class ShipmentTrackingEvent(Base):
    __tablename__ = "shipment_tracking_events"

    id = Column(String(50), primary_key=True, default=lambda: f"trk_{uuid.uuid4().hex[:16]}")
    shipment_id = Column(String(50), ForeignKey("shipments.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    status = Column(String(50), nullable=False)  # Booked, Picked Up, In Transit, Delivered, Delayed, Cancelled
    location = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)
    customer_visible = Column(Boolean, default=True)

    shipment_rel = relationship("Shipment", back_populates="tracking_events")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(String(50), primary_key=True, default=lambda: f"ship_{uuid.uuid4().hex[:16]}")
    awb = Column(String(50), unique=True, nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)
    pickup_date = Column(String(20), nullable=True)
    delivery_date = Column(String(20), nullable=True)

    booking_request_id = Column(String(50), ForeignKey("booking_requests.id"), nullable=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(100), nullable=False, index=True)
    customer_type = Column(String(10), default="C2C", index=True)
    b2b_company_id = Column(String(50), ForeignKey("b2b_companies.id"), nullable=True)

    center = Column(String(100), default="Main Hub (Bangalore)")
    employee = Column(String(100), default="Nawaz")

    # Sender info
    sender_name = Column(String(100), nullable=True)
    sender_phone = Column(String(20), nullable=True)
    sender_address = Column(Text, nullable=True)
    sender_email = Column(String(150), nullable=True)
    sender_id_proof = Column(String(100), nullable=True)

    # Receiver info
    receiver_name = Column(String(100), nullable=False)
    receiver_phone = Column(String(20), nullable=True)
    receiver_address = Column(Text, nullable=True)
    receiver_city = Column(String(100), nullable=False)
    receiver_country = Column(String(100), nullable=False)
    receiver_zip = Column(String(20), nullable=True)
    receiver_email = Column(String(150), nullable=True)
    receiver_state = Column(String(100), nullable=True)
    boxes = Column(JSON, default=list)

    # Parcel & weights
    description = Column(Text, nullable=True)
    packages_count = Column(Integer, default=1)
    actual_weight = Column(Float, default=0.0)
    length = Column(Float, default=0.0)
    width = Column(Float, default=0.0)
    height = Column(Float, default=0.0)
    volumetric_weight = Column(Float, default=0.0)
    chargeable_weight = Column(Float, default=0.0)

    # Courier, Service & Costing
    courier = Column(String(50), nullable=False, index=True)
    domestic_international = Column(String(20), default="International")  # Domestic, International
    service_type = Column(String(100), default="International Priority")
    provider_type = Column(String(20), default="postpaid")  # prepaid, postpaid
    provider_name = Column(String(50), nullable=False)
    price = Column(Float, nullable=False)  # Customer base selling price (excl. GST)
    is_gst_applicable = Column(Boolean, default=True)  # True for Tax Invoice, False for Non-GST/Bill of Supply
    gst_rate = Column(Float, default=18.0)  # Configurable % (0.0, 5.0, 12.0, 14.0, 18.0, 28.0)
    gst_amount = Column(Float, default=0.0)  # Calculated GST currency amount
    total_amount = Column(Float, nullable=True)  # Final total (price + gst_amount)
    provider_cost = Column(Float, nullable=False)  # Predicted provider cost
    actual_provider_cost = Column(Float, nullable=False)  # Actual provider cost
    cost_reconciled = Column(Boolean, default=False)
    gross_profit = Column(Float, default=0.0)

    # Payment details (Rule 8: store BOTH collected_by AND paid_to)
    payment_status = Column(String(20), default="Paid", index=True)  # Paid, Partial, Unpaid, B2B Credit
    payment_method = Column(String(50), default="PhonePe")
    paid_to = Column(String(100), default="Office QR")
    collected_by = Column(String(100), default="Nawaz")

    # Tracking & delay
    status = Column(String(30), default="In Transit", index=True)  # Booked, Picked Up, In Transit, Delivered, Delayed, Cancelled
    delay_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_shipments_customer_status", "customer_id", "status"),
        Index("idx_shipments_date_status", "date", "status"),
        Index("idx_shipments_provider_cost", "provider_name", "cost_reconciled"),
        Index("idx_shipments_center_created", "center", "created_at"),
        Index("idx_shipments_center_status", "center", "status"),
        Index("idx_shipments_customer_created", "customer_id", "created_at"),
    )

    customer_rel = relationship("Customer", back_populates="shipments")
    b2b_company_rel = relationship("B2BCompany", back_populates="shipments")
    invoice_rel = relationship("Invoice", back_populates="shipment_rel", uselist=False)
    tracking_events = relationship("ShipmentTrackingEvent", back_populates="shipment_rel", cascade="all, delete-orphan")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(50), primary_key=True, default=lambda: f"inv_{uuid.uuid4().hex[:16]}")
    invoice_no = Column(String(50), unique=True, nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)
    due_date = Column(String(20), nullable=True)

    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(100), nullable=False)
    b2b_company_id = Column(String(50), ForeignKey("b2b_companies.id"), nullable=True)

    shipment_id = Column(String(50), ForeignKey("shipments.id"), nullable=True)
    awb = Column(String(50), nullable=True, index=True)
    courier = Column(String(50), nullable=True)
    service = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    amount = Column(Float, nullable=False)  # Base taxable amount
    is_gst_invoice = Column(Boolean, default=True)  # True = Tax Invoice, False = Commercial/Bill of Supply
    tax_rate = Column(Float, default=18.0)  # GST rate % (e.g. 18.0, 14.0, 12.0, 5.0, 0.0)
    cgst = Column(Float, default=0.0)  # Central GST amount
    sgst = Column(Float, default=0.0)  # State GST amount
    igst = Column(Float, default=0.0)  # Integrated GST amount
    gst = Column(Float, default=0.0)  # Total GST
    total = Column(Float, nullable=False)  # Final billed total
    paid = Column(Float, default=0.0)
    balance = Column(Float, default=0.0)
    status = Column(String(20), default="Due", index=True)  # Paid, Partial, Due, Overdue

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_invoices_customer_status", "customer_id", "status"),
        Index("idx_invoices_date_status", "date", "status"),
        Index("idx_invoices_customer_created", "customer_id", "created_at"),
    )

    customer_rel = relationship("Customer", back_populates="invoices")
    b2b_company_rel = relationship("B2BCompany", back_populates="invoices")
    shipment_rel = relationship("Shipment", back_populates="invoice_rel")
    payments = relationship("PaymentCollection", cascade="all, delete-orphan")


class PaymentCollection(Base):
    __tablename__ = "payment_collections"

    id = Column(String(50), primary_key=True, default=lambda: f"pay_{uuid.uuid4().hex[:12]}")
    invoice_id = Column(String(50), ForeignKey("invoices.id"), nullable=False, index=True)
    shipment_id = Column(String(50), ForeignKey("shipments.id"), nullable=True, index=True)
    date = Column(String(20), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(100), nullable=False)
    paid_to = Column(String(100), nullable=False)
    collected_by = Column(String(100), nullable=False)
    reference = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AccountCheck(Base):
    __tablename__ = "account_checks"
    id = Column(String(50), primary_key=True, default=lambda: f"check_{uuid.uuid4().hex[:16]}")
    date = Column(String(20), nullable=False, index=True)
    account = Column(String(100), nullable=False, index=True)
    center = Column(String(100), nullable=True, index=True)
    expected_amount = Column(Float, nullable=False)
    counted_amount = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
    receipt_count = Column(Integer, nullable=False)
    notes = Column(String(1000), nullable=True)
    checked_by = Column(String(100), nullable=False)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AccountingEntry(Base):
    __tablename__ = "accounting_entries"
    category = Column(String(100), nullable=True)
    id = Column(String(50), primary_key=True, default=lambda: f"entry_{uuid.uuid4().hex[:16]}")
    date = Column(String(20), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    provider = Column(String(100), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    reference = Column(String(200), nullable=False)
    account = Column(String(100), nullable=False)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(String(50), primary_key=True, default=lambda: f"tx_{uuid.uuid4().hex[:16]}")
    date = Column(String(20), nullable=False, index=True)
    wallet = Column(String(50), nullable=False, index=True)  # ICL, BRV, or dynamic
    type = Column(String(20), nullable=False)  # recharge (transfer), usage (cost)
    amount = Column(Float, nullable=False)
    paid_from = Column(String(100), nullable=True)
    reference = Column(String(100), nullable=True)
    awb = Column(String(50), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    balance_after = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_wallet_tx_wallet_created", "wallet", "created_at"),
    )


class PostpaidProviderAccount(Base):
    __tablename__ = "postpaid_provider_accounts"

    id = Column(String(50), primary_key=True, default=lambda: f"ppa_{uuid.uuid4().hex[:16]}")
    provider_name = Column(String(50), unique=True, nullable=False, index=True)  # Aramex, Blue Dart
    opening_deposit = Column(Float, default=0.0)
    deposit_balance = Column(Float, default=0.0)
    payment_terms = Column(String(50), default="30 Days")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(String(50), primary_key=True, default=lambda: f"rec_{uuid.uuid4().hex[:16]}")
    batch_no = Column(String(50), unique=True, nullable=False, index=True)
    date = Column(String(20), nullable=False)
    provider = Column(String(50), nullable=False, index=True)
    bill_reference = Column(String(100), nullable=True)
    total_shipments = Column(Integer, default=0)
    predicted_total = Column(Float, default=0.0)
    actual_bill = Column(Float, default=0.0)
    variance = Column(Float, default=0.0)
    status = Column(String(20), default="Applied")  # Draft, Applied
    matched_count = Column(Integer, default=0)
    discrepancy_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    items = relationship("ReconciliationItem", back_populates="batch_rel", cascade="all, delete-orphan")


class ReconciliationItem(Base):
    __tablename__ = "reconciliation_items"

    id = Column(String(50), primary_key=True, default=lambda: f"reci_{uuid.uuid4().hex[:16]}")
    batch_id = Column(String(50), ForeignKey("reconciliation_batches.id"), nullable=False, index=True)
    awb = Column(String(50), nullable=False, index=True)
    shipment_id = Column(String(50), nullable=True)
    customer_name = Column(String(100), nullable=True)
    predicted_cost = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)
    variance = Column(Float, default=0.0)
    # Spec Statuses: MATCHED, MISSING AWB, EXTRA AWB, WRONG AMOUNT, DUPLICATE AWB, UNMATCHED
    status = Column(String(30), nullable=False, default="MATCHED")
    notes = Column(Text, nullable=True)

    batch_rel = relationship("ReconciliationBatch", back_populates="items")


class Refund(Base):
    __tablename__ = "refunds"

    id = Column(String(50), primary_key=True, default=lambda: f"ref_{uuid.uuid4().hex[:16]}")
    customer = Column(String(100), nullable=False)
    customer_id = Column(String(50), nullable=True)
    awb = Column(String(50), nullable=False, index=True)
    invoice_no = Column(String(50), nullable=True)
    amount = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    requested_by = Column(String(100), default="Staff")
    request_date = Column(String(20), nullable=False)
    # Lifecycle: Requested -> Approved -> Refunded / Rejected
    status = Column(String(20), default="Requested", index=True)
    approved_by = Column(String(100), nullable=True)
    approval_date = Column(String(20), nullable=True)
    refund_date = Column(String(20), nullable=True)
    refund_method = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Followup(Base):
    __tablename__ = "followups"

    id = Column(String(50), primary_key=True, default=lambda: f"fu_{uuid.uuid4().hex[:16]}")
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=True)
    customer = Column(String(100), nullable=False)
    category = Column(String(50), default="Customer Retention")  # Inactivity 5d/10d/15d/30d, Invoice Due, B2B Payment, Customer Retention
    due_date = Column(String(20), nullable=False, index=True)
    priority = Column(String(20), default="Medium")  # High, Medium, Low
    status = Column(String(20), default="Pending", index=True)  # Pending, Done, Cancelled
    channel_action = Column(String(20), default="WhatsApp")  # Call, WhatsApp, Email, SMS
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    customer_rel = relationship("Customer", back_populates="followups")


class CommunicationLog(Base):
    __tablename__ = "communication_logs"

    id = Column(String(50), primary_key=True, default=lambda: f"comm_{uuid.uuid4().hex[:16]}")
    customer_id = Column(String(50), nullable=True)
    customer = Column(String(100), nullable=False, index=True)
    date = Column(String(20), nullable=False)
    channel = Column(String(20), default="WhatsApp")  # WhatsApp, Call, SMS, Email
    staff = Column(String(100), default="Nawaz")
    message = Column(Text, nullable=False)
    status = Column(String(20), default="Delivered")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_json = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


from sqlalchemy.orm import relationship, foreign


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    auth_user_id = Column(String(50), unique=True, nullable=True, index=True)
    employee_id = Column(String(50), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)
    role = Column(String(50), default="staff", nullable=False)  # backward-compatibility helper
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=True, index=True)
    b2b_company_id = Column(String(50), ForeignKey("b2b_companies.id"), nullable=True, index=True)
    status = Column(String(50), default="invited", nullable=False, index=True)  # invited, active, suspended, archived, pending, approved
    requested_role = Column(String(50), default="staff", nullable=False)
    mfa_required = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(255), nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    recovery_codes = Column(JSON, default=list)
    authorization_version = Column(Integer, default=1, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    password_hash = Column(String(255), nullable=True)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Aliased getter/setter for full_name
    @property
    def full_name(self):
        return self.display_name

    @full_name.setter
    def full_name(self, value):
        self.display_name = value

    # Relationships
    roles = relationship(
        "Role",
        secondary="user_roles",
        primaryjoin="UserProfile.id == foreign(UserRole.user_id)",
        secondaryjoin="Role.id == foreign(UserRole.role_id)",
        back_populates="users"
    )
    centers = relationship(
        "UserCenterAccess",
        foreign_keys="[UserCenterAccess.user_id]",
        back_populates="user_rel",
        cascade="all, delete-orphan"
    )
    sessions = relationship("AppSession", back_populates="user_rel", cascade="all, delete-orphan")


# Maintain Profile alias for backward compatibility
Profile = UserProfile


class Role(Base):
    __tablename__ = "roles"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)  # SUPER_ADMIN cannot be renamed or deleted
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    users = relationship(
        "UserProfile",
        secondary="user_roles",
        primaryjoin="Role.id == foreign(UserRole.role_id)",
        secondaryjoin="UserProfile.id == foreign(UserRole.user_id)",
        back_populates="roles"
    )
    permissions = relationship("RolePermission", back_populates="role_rel", cascade="all, delete-orphan")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    resource = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    code = Column(String(200), unique=True, nullable=False, index=True)  # e.g., 'shipments.view', 'refunds.approve'
    module = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_financial = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        Index("idx_perms_resource_action", "resource", "action", unique=True),
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(String(50), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(String(50), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_by = Column(String(50), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(String(50), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(String(50), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)
    scope = Column(String(50), default="center", nullable=False)  # own, center, all

    role_rel = relationship("Role", back_populates="permissions")
    permission_rel = relationship("Permission")


class UserCenterAccess(Base):
    __tablename__ = "user_center_access"

    user_id = Column(String(50), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True)
    center_id = Column(String(100), primary_key=True)
    scope = Column(String(50), default="operate", nullable=False)  # view, operate, manage
    assigned_by = Column(String(50), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    user_rel = relationship("UserProfile", foreign_keys=[user_id], back_populates="centers")


class AppSession(Base):
    __tablename__ = "app_sessions"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token_hash = Column(String(128), unique=True, nullable=False, index=True)
    ip_address = Column(String(60), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    mfa_verified_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revocation_reason = Column(Text, nullable=True)

    user_rel = relationship("UserProfile", back_populates="sessions")


class UserInvitation(Base):
    __tablename__ = "user_invitations"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    token_hash = Column(String(128), unique=True, nullable=False, index=True)
    role_ids = Column(JSON, default=list)  # list of role ids
    center_ids = Column(JSON, default=list)  # list of center identifiers
    invited_by = Column(String(50), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ProfileAuditLog(Base):
    __tablename__ = "profile_audit_log"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String(50), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by = Column(String(50), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False, index=True)  # approved, rejected, suspended, role_changed, reactivated, created
    old_role = Column(String(50), nullable=True)
    new_role = Column(String(50), nullable=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    profile = relationship("UserProfile", foreign_keys=[profile_id])
    changer = relationship("UserProfile", foreign_keys=[changed_by])
