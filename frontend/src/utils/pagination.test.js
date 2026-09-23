import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages } from './pagination.js';

test('full directories include records beyond both default and maximum page size', async () => {
    const data = Array.from({ length: 1101 }, (_, id) => ({ id, total: 1180 }));
    const offsets = [];
    const rows = await fetchAllPages(async ({ limit, offset }) => {
        offsets.push(offset);
        return { data: data.slice(offset, offset + limit), headers: { 'x-total-count': '1101' } };
    });
    assert.deepEqual(offsets, [0, 500, 1000]);
    assert.equal(rows.length, 1101);
    assert.equal(rows.reduce((sum, row) => sum + row.total, 0), 1101 * 1180);
});

test('missing count headers, empty results, and failed pages are handled', async () => {
    assert.deepEqual(await fetchAllPages(async () => ({ data: [], headers: {} })), []);
    assert.deepEqual(await fetchAllPages(async () => ({ data: [{ id: 1 }], headers: {} })), [{ id: 1 }]);
    await assert.rejects(fetchAllPages(async ({ offset }) => {
        if (offset) throw new Error('Connection failed');
        return { data: Array(500).fill({ id: 1 }), headers: { 'x-total-count': '600' } };
    }), /Connection failed/);
});
