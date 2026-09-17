import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDate, formatRecordTime, formatBusinessDate, shiftCalendarDate } from './businessDates.js';
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


test('record timestamps consistently display IST, including legacy UTC and explicit offsets', () => {
    const expected = formatRecordTime('2026-09-17T20:00:00Z');
    assert.equal(formatRecordTime('2026-09-17T20:00:00'), expected);
    assert.equal(formatRecordTime('2026-09-18T01:30:00+05:30'), expected);
    assert.match(expected, /18/);
    assert.match(expected, /1:30:00/);
    assert.match(expected, /IST$/);
    assert.equal(formatBusinessDate('2026-09-17', { weekday: 'long' }), 'Thursday');
    assert.equal(shiftCalendarDate('2027-01-04', -7), '2026-12-28');
});
