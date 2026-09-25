"""Validate editable business defaults without altering historical transactions."""
from fastapi import HTTPException
import math
import re


def validate_business_options(payload):
    result = dict(payload)
    if 'customerTypes' in result:
        from app.customer_types import normalize_customer_types
        result['customerTypes'] = normalize_customer_types(result['customerTypes'])
    for key, maximum in {'companyName': 150, 'centerAddress': 1000, 'gstin': 30, 'companyPhone': 50, 'companyEmail': 150, 'invoicePrefix': 20}.items():
        if key in result:
            value = result[key]
            if not isinstance(value, str) or len(value.strip()) > maximum:
                raise HTTPException(400, f'Invalid {key}')
            result[key] = value.strip()
    if 'invoicePrefix' in result and not re.fullmatch(r'[A-Za-z0-9_-]{1,20}', result['invoicePrefix']):
        raise HTTPException(400, 'Invoice prefix must contain 1-20 letters, numbers, hyphens or underscores')
    if 'companyName' in result and not result['companyName']:
        raise HTTPException(400, 'Business name is required')
    for key, minimum, maximum in [('defaultGstRate', 0, 100), ('defaultB2BCreditLimit', 0, 1000000000000), ('defaultB2BCreditDays', 1, 365)]:
        if key in result:
            value = result[key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
                raise HTTPException(400, f'Invalid {key}')
            if key == 'defaultB2BCreditDays' and int(value) != value:
                raise HTTPException(400, 'Credit period must be a whole number of days')
    if 'gstRates' in result:
        rates = result['gstRates']
        if not isinstance(rates, list) or not 1 <= len(rates) <= 30 or any(isinstance(n, bool) or not isinstance(n, (int,float)) or not math.isfinite(n) or not 0 <= n <= 100 for n in rates):
            raise HTTPException(400, 'Enter GST rates between 0 and 100')
        result['gstRates'] = sorted(set(rates + [result.get('defaultGstRate', 18)]))
    if 'serviceTypes' in result:
        values = result['serviceTypes']
        if not isinstance(values, list) or not 1 <= len(values) <= 100 or any(not isinstance(v, str) or not v.strip() or len(v.strip()) > 100 for v in values):
            raise HTTPException(400, 'Enter 1-100 services, each with a name of up to 100 characters')
        result['serviceTypes'] = list(dict.fromkeys(v.strip() for v in values))
    if 'couriers' in result:
        values = result['couriers']
        if not isinstance(values, list) or not 1 <= len(values) <= 100 or any(not isinstance(v, str) or not v.strip() or len(v.strip()) > 100 for v in values):
            raise HTTPException(400, 'Enter 1-100 couriers, each with a name of up to 100 characters')
        result['couriers'] = list(dict.fromkeys(v.strip() for v in values))
    if 'centers' in result:
        values = result['centers']
        if not isinstance(values, list) or not 1 <= len(values) <= 100 or any(not isinstance(v, str) or not v.strip() or len(v.strip()) > 100 for v in values):
            raise HTTPException(400, 'Enter 1-100 business centers, each with a name of up to 100 characters')
        result['centers'] = list(dict.fromkeys(v.strip() for v in values))
    if 'paymentMethods' in result:
        supported = {'UPI','PhonePe','Google Pay','Office QR','Cash','Bank Transfer','Cheque','Card','Other'}
        methods = result['paymentMethods']
        if not isinstance(methods, list) or not methods or any(not isinstance(v, str) or v not in supported for v in methods):
            raise HTTPException(400, 'Select at least one supported payment method')
        result['paymentMethods'] = list(dict.fromkeys(methods))
    if 'courierLogos' in result:
        logos = result['courierLogos']
        if not isinstance(logos, dict):
            raise HTTPException(400, 'courierLogos must be an object')
        result['courierLogos'] = {str(k).strip(): str(v).strip() for k, v in logos.items() if str(k).strip() and str(v).strip()}
    if 'messageTemplates' in result:
        templates = result['messageTemplates']
        if not isinstance(templates, list):
            raise HTTPException(400, 'messageTemplates must be a list of templates')
        valid_templates = []
        for item in templates:
            if isinstance(item, dict) and ('title' in item or 'name' in item) and 'body' in item:
                valid_templates.append({
                    'id': str(item.get('id') or f"tpl_{len(valid_templates)+1}"),
                    'title': str(item.get('title') or item.get('name') or '').strip()[:100],
                    'channel': str(item.get('channel', 'All')).strip()[:20],
                    'body': str(item.get('body', '')).strip()[:4000],
                    'category': str(item.get('category', 'custom')).strip()[:30]
                })
        result['messageTemplates'] = valid_templates
    return result
