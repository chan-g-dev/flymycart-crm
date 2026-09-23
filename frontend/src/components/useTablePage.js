import { useState } from 'react';

export default function useTablePage(rows, resetKey = '') {
    const [selection, setSelection] = useState({ key: resetKey, page: 1 });
    const totalPages = Math.max(1, Math.ceil(rows.length / 50));
    const page = Math.min(selection.key === resetKey ? selection.page : 1, totalPages);
    if (selection.key !== resetKey || selection.page !== page) {
        setSelection({ key: resetKey, page });
    }
    return {
        rows: rows.slice((page - 1) * 50, page * 50),
        page, totalPages, total: rows.length,
        setPage: next => setSelection({ key: resetKey, page: Math.max(1, Math.min(next, totalPages)) }),
    };
}

