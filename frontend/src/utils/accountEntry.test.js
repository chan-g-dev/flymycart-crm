import test from 'node:test';
import assert from 'node:assert/strict';
import { entryKindForCategory } from './accountEntry.js';
test('courier bill category routes to carrier payments instead of operating expenses', () => {
    for (const category of ['Courier Partner Bill (Monthly)', '  CARRIER BILL ', 'Courier Bill']) assert.equal(entryKindForCategory(category), 'provider_payment');
});
test('switching back to an ordinary category restores operating expense entry', () => {
    for (const category of ['Office Rent', 'Packing', '', null]) assert.equal(entryKindForCategory(category), 'expense');
});
