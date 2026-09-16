import React from 'react';

export default function PaymentDetailsSummary({ details }) {
    if (!details) return <small>Details not recorded (legacy)</small>;
    return <details><summary>Payment details</summary><div style={{ minWidth: 150, whiteSpace: 'normal' }}>
        <div>{details.owner_type} · {details.account_holder}</div>
        {details.upi_id && <div>UPI: {details.upi_id}</div>}
        {details.bank_name && <div>{details.bank_name} · Account ending {details.account_number?.slice(-4)} · {details.ifsc}</div>}
        {details.card_last4 && <div>Card ending {details.card_last4}</div>}
        {details.other_details && <div>{details.other_details}</div>}
        {details.reference && <div>Reference: {details.reference}</div>}
        {details.remarks && <div>{details.remarks}</div>}
    </div></details>;
}
