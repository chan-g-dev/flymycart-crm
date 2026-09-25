/**
 * Communication helper for 1-click WhatsApp, Email, and Phone calls
 */

/**
 * Clean and format phone number for WhatsApp wa.me API
 */
export function cleanPhoneForWhatsApp(phone, defaultCountryCode = '91') {
    if (!phone) return '';
    let cleaned = String(phone).trim().replace(/[\s().-]/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    } else {
        if (defaultCountryCode === '91' && /^0[6-9]\d{9}$/.test(cleaned)) cleaned = cleaned.slice(1);
        if (/^\d{10}$/.test(cleaned)) {
            cleaned = `${defaultCountryCode}${cleaned}`;
        }
    }
    return /^[1-9]\d{7,14}$/.test(cleaned) ? cleaned : '';
}

/**
 * Clean phone for tel: protocol
 */
export function cleanPhoneForCall(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^\d+]/g, '');
}

/**
 * Trigger WhatsApp chat in a new browser tab or mobile app
 */
export function openWhatsApp({ phone, message = '' }) {
    const cleanNum = cleanPhoneForWhatsApp(phone);
    if (!cleanNum) {
        alert('No valid phone number available for WhatsApp.');
        return false;
    }
    const encodedMsg = encodeURIComponent(message);
    const url = `https://wa.me/${cleanNum}?text=${encodedMsg}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
}

/**
 * Trigger Default Email Client
 */
export function openEmail({ email, subject = '', body = '' }) {
    if (!email) {
        alert('No email address provided for this customer.');
        return false;
    }
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    return true;
}

/**
 * Trigger Phone Dialer
 */
export function openCall({ phone }) {
    const cleanNum = cleanPhoneForCall(phone);
    if (!cleanNum) {
        alert('No phone number available to dial.');
        return false;
    }
    window.location.href = `tel:${cleanNum}`;
    return true;
}

/**
 * Pre-formatted default message templates for WhatsApp, Email & SMS
 */
export function getDefaultMessageTemplates(_companyName = 'Fly My Cart Logistics') {
    return [
        {
            id: 'invoice_share',
            title: '📄 Invoice Sharing / Bill Notice',
            channel: 'WhatsApp',
            category: 'invoice',
            body: `Dear {customer_name},\n\nThank you for choosing {company_name}!\n\n📄 Document: {doc_title}\n🧾 No: {invoice_no}\n📦 AWB: {awb}\n💰 Total Amount: ₹{total_amount}\n💳 Amount Paid: ₹{paid_amount}\n⚠️ Balance: ₹{balance}\n\n{tracking_text}\n\n{company_name}`
        },
        {
            id: 'payment_reminder',
            title: '🔔 Payment Dues Reminder',
            channel: 'All',
            category: 'payment_reminder',
            body: `Dear {customer_name},\n\nGreetings from {company_name}!\n\nThis is a gentle reminder regarding your pending balance of ₹{balance} for Invoice #{invoice_no} (AWB: {awb}).\n\nKindly process the payment at your earliest convenience. If already settled, kindly disregard this notice.\n\nThank you for choosing {company_name}!`
        },
        {
            id: 'shipment_dispatch',
            title: '📦 AWB Tracking & Dispatch Update',
            channel: 'WhatsApp',
            category: 'dispatch',
            body: `Hello {customer_name},\n\nYour consignment has been booked and dispatched successfully with {company_name}!\n\n📦 AWB Number: {awb}\n🚚 Courier Partner: {courier}\n📍 Destination: {destination}\n\n{tracking_text}\n\nTrack your parcel anytime or reply here for assistance. Thank you!`
        },
        {
            id: 'general_greeting',
            title: '👋 Customer Follow-up & Greeting',
            channel: 'All',
            category: 'greeting',
            body: `Hello {customer_name},\n\nGreeting from {company_name}! We are following up regarding your courier and logistics shipments. How may we assist you today?\n\nWarm regards,\n{company_name}`
        }
    ];
}

/**
 * Replace placeholders in template text with actual data
 */
export function formatTemplate(templateBody = '', data = {}) {
    if (!templateBody) return '';
    const company = data.companyName || data.company || 'Fly My Cart Logistics';
    const customer = data.customerName || data.customer || data.name || 'Customer';
    const invoiceNo = data.invoiceNo || data.invoice_no || '';
    const awb = data.awb || '';
    const courier = data.courier || 'Express Air';
    const destination = data.destination || data.city || data.country || 'Destination';
    const docTitle = data.docTitle || data.doc_title || 'Commercial Invoice / Bill of Supply';
    
    const total = data.totalAmount ?? data.total ?? data.amount ?? 0;
    const paid = data.paidAmount ?? data.paid ?? 0;
    const bal = data.dueAmount ?? data.balance ?? data.outstanding ?? (Number(total) - Number(paid));
    
    const formattedTotal = Number(total).toLocaleString('en-IN');
    const formattedPaid = Number(paid).toLocaleString('en-IN');
    const formattedBal = Number(bal).toLocaleString('en-IN');

    const trackingUrl = data.trackingUrl || data.tracking_url || '';
    const trackingText = trackingUrl 
        ? `Track your ${courier} shipment: ${trackingUrl}`
        : `Contact ${company} for instant tracking assistance.`;

    return templateBody
        .replace(/\{customer_name\}/gi, customer)
        .replace(/\{company_name\}/gi, company)
        .replace(/\{invoice_no\}/gi, invoiceNo)
        .replace(/\{awb\}/gi, awb)
        .replace(/\{total_amount\}/gi, formattedTotal)
        .replace(/\{paid_amount\}/gi, formattedPaid)
        .replace(/\{balance\}/gi, formattedBal)
        .replace(/\{due_amount\}/gi, formattedBal)
        .replace(/\{courier\}/gi, courier)
        .replace(/\{destination\}/gi, destination)
        .replace(/\{doc_title\}/gi, docTitle)
        .replace(/\{tracking_text\}/gi, trackingText)
        .replace(/\{tracking_url\}/gi, trackingUrl);
}

/**
 * Available placeholders guide for UI editor
 */
export const AVAILABLE_PLACEHOLDERS = [
    { tag: '{customer_name}', label: 'Customer Name', desc: 'e.g. John Doe / Acme Corp' },
    { tag: '{company_name}', label: 'Company Name', desc: 'e.g. Fly My Cart Logistics' },
    { tag: '{invoice_no}', label: 'Invoice Number', desc: 'e.g. FMC-202609-001' },
    { tag: '{awb}', label: 'AWB Number', desc: 'e.g. FX260831001' },
    { tag: '{total_amount}', label: 'Total Amount', desc: 'e.g. 2,000' },
    { tag: '{paid_amount}', label: 'Paid Amount', desc: 'e.g. 1,500' },
    { tag: '{balance}', label: 'Balance / Due', desc: 'e.g. 500' },
    { tag: '{courier}', label: 'Courier Partner', desc: 'e.g. FedEx, DHL' },
    { tag: '{destination}', label: 'Destination', desc: 'e.g. London, UK' },
    { tag: '{doc_title}', label: 'Document Title', desc: 'e.g. Tax Invoice' },
    { tag: '{tracking_text}', label: 'Tracking Notice', desc: 'Tracking link or support message' }
];

/**
 * Pre-formatted message templates for quick staff interaction
 */
export const CommTemplates = {
    paymentReminder: ({ customerName = 'Customer', dueAmount = 0, invoiceNo = '', awb = '', companyName = 'Fly My Cart Logistics' }) => {
        const formattedAmt = '₹' + Number(dueAmount || 0).toLocaleString('en-IN');
        return `Dear ${customerName},\n\nGreetings from ${companyName}!\n\nThis is a gentle reminder regarding your pending balance of ${formattedAmt}${invoiceNo ? ` for Invoice #${invoiceNo}` : ''}${awb ? ` (AWB: ${awb})` : ''}.\n\nKindly process the payment at your earliest convenience. If already paid, please ignore this notice.\n\nThank you for choosing ${companyName}!`;
    },

    shipmentDispatch: ({ customerName = 'Customer', awb = '', courier = '', destination = '', companyName = 'Fly My Cart Logistics' }) => {
        return `Hello ${customerName},\n\nYour consignment has been booked and dispatched successfully with ${companyName}!\n\n📦 AWB Number: ${awb}\n🚚 Courier Partner: ${courier || 'Express Air'}\n📍 Destination: ${destination || 'Destined Address'}\n\nTrack your parcel anytime or reply here for questions. Thank you!`;
    },

    invoiceNotice: ({ customerName = 'Customer', invoiceNo = '', totalAmount = 0, companyName = 'Fly My Cart Logistics' }) => {
        const formattedAmt = '₹' + Number(totalAmount || 0).toLocaleString('en-IN');
        return `Dear ${customerName},\n\nYour Tax Invoice #${invoiceNo} for ${formattedAmt} has been generated by ${companyName}.\n\nPlease let us know if you need any assistance or GST documentation.\n\nWarm regards,\n${companyName}`;
    },

    generalGreeting: ({ customerName = 'Customer', companyName = 'Fly My Cart Logistics' }) => {
        return `Hello ${customerName},\n\nGreeting from ${companyName}! We are following up regarding your courier and logistics shipments. How may we assist you today?`;
    }
};
