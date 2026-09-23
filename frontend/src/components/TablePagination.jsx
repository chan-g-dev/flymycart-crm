import React from 'react';

export default function TablePagination({ page, totalPages, total, setPage }) {
    if (!total) return null;
    return <nav aria-label="Table pagination" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12 }}>
        <span>{(page - 1) * 50 + 1}?{Math.min(page * 50, total)} of {total}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
    </nav>;
}
