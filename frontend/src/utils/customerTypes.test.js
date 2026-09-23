import test from 'node:test';
import assert from 'node:assert/strict';
import { customerTypeOptions } from './customerTypes.js';

test('customer categories include defaults and saved custom types without duplicate labels', () => {
    assert.deepEqual(customerTypeOptions(), ['C2C', 'B2C', 'B2B']);
    assert.deepEqual(customerTypeOptions({ customerTypes: ['b2b', ' Distributor ', 'distributor', 'Marketplace'] }), ['C2C', 'B2C', 'B2B', 'Distributor', 'Marketplace']);
});

test('historical customer categories remain available in filters and selected bookings', () => {
    assert.deepEqual(customerTypeOptions({ customerTypes: ['Distributor'] }, ['Archived', 'Distributor', null, '']), ['C2C', 'B2C', 'B2B', 'Distributor', 'Archived']);
});
