export function dateAfter(days = 0, from = new Date()) {
    const date = new Date(from);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function followupBuckets(followups, today = dateAfter()) {
    const end = dateAfter(7, new Date(`${today}T12:00:00`));
    const pending = (followups || []).filter(item => item.status === 'Pending');
    return {
        dueToday: pending.filter(item => item.due_date === today),
        overdue: pending.filter(item => item.due_date && item.due_date < today),
        upcoming: pending.filter(item => item.due_date > today && item.due_date <= end),
    };
}
