import React from 'react';

export default function TablePagination({ 
    page, 
    totalPages, 
    total, 
    setPage 
}) {
    if (!total) return null;
    return (
        <nav className="table-pagination" aria-label="Table pagination">
            <div className="table-pagination-info">
                <span>Showing <strong>{(page - 1) * 50 + 1}</strong> to <strong>{Math.min(page * 50, total)}</strong> of <strong>{total}</strong></span>
            </div>

            <div className="table-pagination-controls">
                <button 
                    type="button"
                    className="btn btn-outline" 
                    disabled={page <= 1} 
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>
                <span className="pagination-page-indicator">Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong></span>
                <button 
                    type="button"
                    className="btn btn-outline" 
                    disabled={page >= totalPages} 
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </div>
        </nav>
    );
}
