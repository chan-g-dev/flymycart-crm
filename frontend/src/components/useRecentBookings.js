import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export default function useRecentBookings(center, refreshKey, scope = '', entity = '') {
    const [filter, setFilter] = useState({ date: '', page: 1, center, scope, entity });
    const [result, setResult] = useState(null);
    const [retry, setRetry] = useState(0);

    if (filter.center !== center || filter.scope !== scope || filter.entity !== entity) {
        setFilter({ ...filter, center, scope, entity, page: 1 });
    }
    const page = (filter.center === center && filter.scope === scope && filter.entity === entity) ? filter.page : 1;
    const key = JSON.stringify([center, scope, entity, filter.date, page, retry]);

    useEffect(() => {
        const controller = new AbortController();
        apiClient.getShipmentsPage({
            center,
            scope: scope || undefined,
            entity: entity || undefined,
            booking_date: filter.date || undefined,
            limit: 10,
            offset: (page - 1) * 10
        }, controller.signal)
            .then(data => {
                if (controller.signal.aborted) return;
                const lastPage = Math.max(1, Math.ceil(data.total / 10));
                if (page > lastPage) setFilter(previous => ({ ...previous, page: lastPage }));
                else setResult({ key, ...data });
            })
            .catch(() => {
                if (!controller.signal.aborted) setResult({ key, items: [], total: 0, error: 'Could not load bookings. Please try again.' });
            });
        return () => controller.abort();
    }, [center, scope, entity, filter.date, page, key, refreshKey]);

    const current = result?.key === key ? result : null;
    return {
        date: filter.date, page, items: current?.items || [], total: current?.total || 0,
        loading: !current, error: current?.error,
        setDate: date => setFilter({ date, page: 1, center, scope, entity }),
        setPage: next => setFilter(previous => ({ ...previous, page: next })),
        retry: () => setRetry(previous => previous + 1),
    };
}
