import { businessDate } from './businessDates.js';

export function dateAfter(days = 0, from = new Date()) {
    const date = new Date(`${businessDate(from)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function followupBuckets(followups, today = dateAfter()) {
    const end = dateAfter(7, new Date(`${today}T12:00:00+05:30`));
    const pending = (followups || []).filter(item => item.status === 'Pending');
    return {
        dueToday: pending.filter(item => item.due_date === today),
        overdue: pending.filter(item => item.due_date && item.due_date < today),
        upcoming: pending.filter(item => item.due_date > today && item.due_date <= end),
    };
}
