import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentOptions, supportedPaymentMethods } from './businessOptions.js';
test('saved payment choices are used while legacy unsupported modes are excluded', () => {
    assert.deepEqual(paymentOptions({ paymentMethods: ['Cash', 'Bank Transfer'] }), ['Cash', 'Bank Transfer']);
    assert.deepEqual(paymentOptions({ paymentMethods: ['PhonePe', 'B2B Credit'] }), ['PhonePe']);
    assert.deepEqual(paymentOptions({}), supportedPaymentMethods);
});
