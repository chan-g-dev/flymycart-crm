import React from 'react';
import { getTrackingUrl } from '../utils/tracking';

export const TrackingLink = ({ awb, courier, className = '', style = {} }) => {
    const trackingUrl = getTrackingUrl(courier);
    const content = awb || '-';

    if (!trackingUrl || !awb) return <span className={className} style={style}>{content}</span>;

    return (
        <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            style={{ color: 'var(--primary-blue)', textDecoration: 'none', ...style }}
            title={`Track ${courier} AWB ${content}`}
            aria-label={`Track ${courier} AWB ${content} on the ${courier} website`}
        >
            {content}
        </a>
    );
};

export default TrackingLink;
