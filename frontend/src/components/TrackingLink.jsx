import React from 'react';

export const BLUE_DART_TRACKING_URL = 'https://www.bluedart.com/tracking';

export const getTrackingUrl = (courier) => {
    const name = String(courier || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const urls = {
        bluedart: BLUE_DART_TRACKING_URL,
        bluedartexpress: BLUE_DART_TRACKING_URL,
        fedex: 'https://www.fedex.com/en-us/tracking.html',
        aramex: 'https://www.aramex.com/ae/en/track/shipments',
        dhl: 'https://www.dhl.com/us-en/home/tracking.html',
        dhlexpress: 'https://www.dhl.com/us-en/home/tracking.html',
        ups: 'https://www.ups.com/track/?loc=en_US',
        delhivery: 'https://www.delhivery.com/tracking',
        sreemaruthi: 'https://tracking.shreemaruti.com/',
        sreemaruthicourier: 'https://tracking.shreemaruti.com/',
        shreemaruti: 'https://tracking.shreemaruti.com/',
        shreemaruticourier: 'https://tracking.shreemaruti.com/',
    };
    return urls[name] || null;
};

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
