export const supportedPaymentMethods = ['UPI', 'PhonePe', 'Google Pay', 'Office QR', 'Cash', 'Bank Transfer', 'Cheque', 'Card', 'Other'];
export const paymentOptions = settings => settings?.paymentMethods?.filter(value => supportedPaymentMethods.includes(value)).length ? settings.paymentMethods.filter(value => supportedPaymentMethods.includes(value)) : supportedPaymentMethods;
