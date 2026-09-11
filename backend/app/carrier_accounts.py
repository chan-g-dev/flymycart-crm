def ensure_carrier_accounts(config):
    """Add both billing options without changing existing account balances or terms."""
    result = dict(config or {})
    def key(name):
        value = ''.join(c for c in name.lower() if c.isalnum())
        return {'dhlexpress': 'dhl'}.get(value, value)
    for field in ('prepaidWallets', 'postpaidProviders'):
        accounts = [dict(account) for account in result.get(field, [])]
        existing = {key(account['name']) for account in accounts}
        for carrier in result.get('couriers', []):
            if key(carrier) in existing:
                continue
            account = {'name': carrier}
            if field == 'prepaidWallets':
                account.update(openingBalance=0.0, currency='INR')
            else:
                account.update(deposit=0.0, paymentTerms='Not set', accountNo='')
            accounts.append(account)
            existing.add(key(carrier))
        result[field] = accounts
    return result
