import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createPaymentSender } from './paymentRequests.js';

function storage() {
    const values = new Map();
    return { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), values };
}

test('timeout retry survives a reload and uses the same key; success clears it', async () => {
    const saved = storage(); const keys = [];
    const failing = createPaymentSender({ storage: saved, crypto: webcrypto, send: async config => { keys.push(config.headers['Idempotency-Key']); throw new Error('timeout'); } });
    await assert.rejects(failing('post', '/payments', { amount: 100, upi_id: 'owner@bank' }));
    assert.equal(saved.values.size, 1);
    assert(!JSON.stringify([...saved.values]).includes('owner@bank'));
    const retry = createPaymentSender({ storage: saved, crypto: webcrypto, send: async config => { keys.push(config.headers['Idempotency-Key']); return { data: { id: 'payment-1' } }; } });
    assert.deepEqual(await retry('post', '/payments', { amount: 100, upi_id: 'owner@bank' }), { id: 'payment-1' });
    assert.equal(keys[0], keys[1]); assert.equal(saved.values.size, 0);
});

test('simultaneous clicks send one request', async () => {
    let count = 0;
    const send = createPaymentSender({ storage: storage(), crypto: webcrypto, send: async () => { count++; await new Promise(resolve => setTimeout(resolve, 20)); return { data: 'ok' }; } });
    assert.deepEqual(await Promise.all([send('post', '/payments', { amount: 1 }), send('post', '/payments', { amount: 1 })]), ['ok', 'ok']);
    assert.equal(count, 1);
});

test('validation errors release the key; unavailable storage still preserves network retries', async () => {
    const keys = []; let status = 400;
    const send = createPaymentSender({ storage: { getItem() { throw Error(); }, setItem() { throw Error(); } }, crypto: webcrypto,
        send: async config => { keys.push(config.headers['Idempotency-Key']); throw { response: { status } }; } });
    await assert.rejects(send('post', '/payments', {})); status = 503;
    await assert.rejects(send('post', '/payments', {}));
    await assert.rejects(send('post', '/payments', {}));
    assert.notEqual(keys[0], keys[1]); assert.equal(keys[1], keys[2]);
});

test('synchronous transport failure and reordered fields still retry with the same key', async () => {
    const keys = []; let fail = true;
    const send = createPaymentSender({ storage: storage(), crypto: webcrypto, send: config => {
        keys.push(config.headers['Idempotency-Key']);
        if (fail) throw new Error('transport failed');
        return { data: 'ok' };
    } });
    await assert.rejects(send('post', '/payments', { amount: 1, details: { name: 'Owner', type: 'Cash' } }));
    fail = false;
    assert.equal(await send('post', '/payments', { details: { type: 'Cash', name: 'Owner' }, amount: 1 }), 'ok');
    assert.equal(keys[0], keys[1]);
});
