import React from 'react';
export default function ShipmentPaymentCells({ shipment }) {
    const collected = shipment.payment_status === 'Paid' || shipment.payment_status === 'Collected';
    const courierStatus = shipment.provider_type === 'prepaid' ? 'Paid' : 'Pending';
    return <><td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{shipment.payment_method || 'Not recorded'}</td><td style={{ textAlign: 'center' }}><span className={`status-pill ${collected ? 'delivered' : 'in-transit'}`}>{collected ? 'Collected' : shipment.payment_status || 'Not recorded'}</span></td><td style={{ textAlign: 'center' }}><span className={`status-pill ${courierStatus === 'Paid' ? 'delivered' : 'in-transit'}`}>{courierStatus}</span></td></>;
}
