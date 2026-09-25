import test from 'node:test';
import assert from 'node:assert/strict';
import { clearShipmentCustomer, selectShipmentCustomer } from './shipmentCustomer.js';

test('corporate selection keeps company and customer identities separate', () => {
    const form = selectShipmentCustomer({ payment_status: 'B2B Credit' }, {
        id: 'b2b_1', company: 'Company', name: 'Contact', customer_type: 'B2B',
        is_b2b_corporate: true, mobile: '+91 9876543210', b2b_company_id: 'b2b_1',
    });
    assert.equal(form.customer_id, '');
    assert.equal(form.b2b_company_id, 'b2b_1');
    assert.equal(form.sender_phone, '9876543210');
    assert.equal(form.customer_name, 'Company');
});

test('changing to B2C removes corporate credit and previous identity documents', () => {
    const previous = { customer_id: 'old', b2b_company_id: 'company', payment_status: 'B2B Credit',
        sender_email: 'old@example.test', id_proof_front: 'previous-document', sender_city: 'Old city' };
    const form = selectShipmentCustomer(previous, { id: 'retail', customer_type: 'B2C', name: 'Retail', mobile: '9000000000' });
    assert.equal(form.customer_id, 'retail');
    assert.equal(form.b2b_company_id, '');
    assert.equal(form.payment_status, 'Unpaid');
    assert.equal(form.sender_email, '');
    assert.equal(form.id_proof_front, '');
    assert.equal(form.sender_city, '');
    assert.equal(clearShipmentCustomer(previous).customer_id, '');
});

test('existing corporate customer selection preserves both saved IDs', () => {
    const form = selectShipmentCustomer({}, { id: 'customer', customer_id: 'customer', b2b_company_id: 'company', customer_type: 'B2B', name: 'Existing' });
    assert.equal(form.customer_id, 'customer');
    assert.equal(form.b2b_company_id, 'company');
});
