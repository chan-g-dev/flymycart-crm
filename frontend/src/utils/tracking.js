export const BLUE_DART_TRACKING_URL = 'https://www.bluedart.com/tracking';
export const ICL_TRACKING_URL = 'https://iclexpress.in/tracking/';

export const getTrackingUrl = (courier, awb = '', customSettings = null) => {
    if (!courier) return null;
    const name = String(courier || '').trim();
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Check custom settings or localStorage overrides
    try {
        const settings = customSettings || (typeof window !== 'undefined' ? window.__FMC_SETTINGS__ : null);
        const customUrls = settings?.courierTrackingUrls || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('fmc_courier_tracking_urls') || '{}') : {});
        const matchedCustom = customUrls[name] || customUrls[key];
        if (matchedCustom) {
            if (awb && matchedCustom.includes('{awb}')) {
                return matchedCustom.replace(/\{awb\}/g, encodeURIComponent(awb));
            }
            return matchedCustom;
        }
    } catch {}

    const urls = {
        icl: ICL_TRACKING_URL,
        iclexpress: ICL_TRACKING_URL,
        iclcourier: ICL_TRACKING_URL,
        iclinternational: ICL_TRACKING_URL,
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
        atlantic: 'https://atlanticcourier.net/tracking',
        atlanticcourier: 'https://atlanticcourier.net/tracking',
        dtdc: 'https://www.dtdc.in/tracking/shipment-tracking.asp',
        trackon: 'https://trackon.in/track',
        speedpost: 'https://www.indiapost.gov.in/_layouts/15/dpt.cpt.application/tracking.aspx',
        indiapost: 'https://www.indiapost.gov.in/_layouts/15/dpt.cpt.application/tracking.aspx',
    };

    return urls[key] || null;
};

