import React from 'react';
import { Loader2 } from 'lucide-react';

export const ContentShimmer = ({ message = 'Loading financial records...' }) => {
    return (
        <div className="fmc-content-shimmer-container">
            {/* Header Banner Loader */}
            <div className="fmc-shimmer-header">
                <div className="fmc-shimmer-spinner">
                    <Loader2 className="fmc-spin-icon" size={18} />
                </div>
                <div className="fmc-shimmer-text">
                    <strong>{message}</strong>
                    <span>Extracting real-time records from single-entry database...</span>
                </div>
            </div>

            {/* Skeleton KPI Cards Grid */}
            <div className="fmc-skeleton-kpi-grid">
                {[1, 2, 3, 4, 5].map((k) => (
                    <div key={k} className="fmc-skeleton-kpi-card">
                        <div className="fmc-skeleton-bar fmc-w-40"></div>
                        <div className="fmc-skeleton-bar fmc-w-70 fmc-h-lg"></div>
                        <div className="fmc-skeleton-bar fmc-w-50 fmc-h-sm"></div>
                    </div>
                ))}
            </div>

            {/* Skeleton Content Grid or Table */}
            <div className="fmc-skeleton-body-card">
                <div className="fmc-skeleton-row-header">
                    <div className="fmc-skeleton-bar fmc-w-30"></div>
                    <div className="fmc-skeleton-bar fmc-w-20"></div>
                </div>

                <div className="fmc-skeleton-table-rows">
                    {[1, 2, 3, 4, 5, 6].map((r) => (
                        <div key={r} className="fmc-skeleton-table-row">
                            <div className="fmc-skeleton-bar fmc-w-15"></div>
                            <div className="fmc-skeleton-bar fmc-w-35"></div>
                            <div className="fmc-skeleton-bar fmc-w-20"></div>
                            <div className="fmc-skeleton-bar fmc-w-15"></div>
                            <div className="fmc-skeleton-bar fmc-w-10"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ContentShimmer;
