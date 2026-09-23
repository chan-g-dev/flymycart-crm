import React from 'react';

export default function ShipmentPaymentCells({ shipment }) {
    const collected = shipment.payment_status === 'Paid' || shipment.payment_status === 'Collected';
    const courierStatus = shipment.carrier_payment_status
        || (shipment.provider_type === 'prepaid' ? 'Paid' : (shipment.cost_reconciled ? 'Reconciled' : 'Pending'));
    const pillClass = courierStatus === 'Paid' ? 'delivered' : courierStatus === 'Reconciled' ? 'picked-up' : 'in-transit';

    return (
        <>
            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{shipment.payment_method || 'Not recorded'}</td>
            <td style={{ textAlign: 'center' }}>
                <span className={`status-pill ${collected ? 'delivered' : 'in-transit'}`}>
                    {collected ? 'Collected' : shipment.payment_status || 'Not recorded'}
                </span>
            </td>
            <td style={{ textAlign: 'center' }}>
                <span className={`status-pill ${pillClass}`}>
                    {courierStatus}
                </span>
            </td>
        </>
    );
}
