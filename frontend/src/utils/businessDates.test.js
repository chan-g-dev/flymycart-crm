import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDate } from './businessDates.js';
import { dateAfter, followupBuckets } from './followupDates.js';

test('IST business day and month roll over at 18:30 UTC', () => {
    assert.equal(businessDate(new Date('2026-09-30T18:29:59Z')), '2026-09-30');
    assert.equal(businessDate(new Date('2026-09-30T18:30:00Z')), '2026-10-01');
    assert.equal(dateAfter(5, new Date('2026-12-31T18:30:00Z')), '2027-01-06');
});

test('follow-up buckets agree with the business calendar', () => {
    const items = [
        { status: 'Pending', due_date: '2026-09-30' },
        { status: 'Pending', due_date: '2026-10-01' },
        { status: 'Pending', due_date: '2026-10-08' },
        { status: 'Pending', due_date: '2026-10-09' },
    ];
    const buckets = followupBuckets(items, '2026-10-01');
    assert.deepEqual(buckets.overdue, [items[0]]);
    assert.deepEqual(buckets.dueToday, [items[1]]);
    assert.deepEqual(buckets.upcoming, [items[2]]);
});
