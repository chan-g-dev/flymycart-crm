export const isCourierBillCategory = value => ['courier partner bill (monthly)', 'carrier bill', 'courier bill'].includes(String(value || '').trim().toLowerCase());
export const entryKindForCategory = value => isCourierBillCategory(value) ? 'provider_payment' : 'expense';
