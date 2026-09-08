import React from 'react';

export const BLUE_DART_TRACKING_URL = 'https://www.bluedart.com/tracking';

export const getTrackingUrl = (courier) => {
    return /blue\s*dart/i.test(String(courier || '')) ? BLUE_DART_TRACKING_URL : null;
};

export const TrackingLink = ({ awb, courier, className = '', style = {} }) => {
    const trackingUrl = getTrackingUrl(courier);
    const content = awb || '-';

    if (!trackingUrl) return <span className={className} style={style}>{content}</span>;

    return (
        <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            style={{ color: 'var(--primary-blue)', textDecoration: 'none', ...style }}
            title={`Track Blue Dart AWB ${content}`}
            aria-label={`Track Blue Dart AWB ${content} on the Blue Dart website`}
        >
            {content}
        </a>
    );
};

export default TrackingLink;
