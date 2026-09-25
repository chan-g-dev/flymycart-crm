export function clearShipmentCustomer(form) {
    return {
        ...form,
        customer_id: '', b2b_company_id: '', customer_name: '',
        sender_email: '', sender_id_proof: '', id_proof_front: '', id_proof_back: '',
        sender_address: '', sender_city: '', sender_state: '', sender_zip: '', sender_country: 'India',
        same_sender: true, alternate_sender_name: '', alternate_sender_phone: '',
    };
}

export function selectShipmentCustomer(form, customer) {
    const phone = String(customer.mobile || '').trim();
    const parts = phone.match(/^(\+\d{1,4})\s+(.+)$/);
    const phoneCode = parts?.[1] || (phone.startsWith('+91') ? '+91' : form.sender_phone_code || '+91');
    const phoneNumber = parts?.[2] || (phone.startsWith('+91') ? phone.slice(3).trim() : phone);
    const category = customer.customer_type || (customer.is_b2b_corporate ? 'B2B' : form.customer_type);
    return {
        ...clearShipmentCustomer(form),
        customer_id: customer.is_b2b_corporate ? customer.customer_id || '' : customer.customer_id || customer.id,
        b2b_company_id: category === 'B2B' ? customer.b2b_company_id || (customer.is_b2b_corporate ? customer.id : '') : '',
        customer_name: customer.company || customer.name,
        customer_type: category,
        sender_phone: phoneNumber, sender_phone_code: phoneCode,
        sender_email: customer.email || '', sender_id_proof: customer.id_proof || '',
        id_proof_front: customer.id_proof_front || '', id_proof_back: customer.id_proof_back || '',
        sender_address: customer.address || '',
        payment_status: category === 'B2B' ? (form.payment_status === 'Paid' ? 'Paid' : 'B2B Credit') : (form.payment_status === 'B2B Credit' ? 'Unpaid' : (form.payment_status || 'Unpaid')),
    };
}
