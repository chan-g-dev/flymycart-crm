DEFAULT_COURIERS = ["FedEx", "Aramex", "DHL", "Blue Dart", "Delhivery", "UPS", "Sree Maruthi", "ICL", "BRV"]


def ensure_carrier_accounts(config):
    """Ensure all active couriers are synchronized 1-to-1 across couriers list, prepaidWallets, and postpaidProviders."""
    result = dict(config or {})

    def key(name):
        value = ''.join(c for c in str(name).lower() if c.isalnum())
        return {'dhlexpress': 'dhl'}.get(value, value)

    raw_couriers = result.get('couriers')
    if raw_couriers is None:
        couriers = list(DEFAULT_COURIERS)
    else:
        couriers = [str(c).strip() for c in raw_couriers if str(c).strip()]
        # If ICL / BRV or other existing accounts were configured, make sure they are in couriers
        for f in ('prepaidWallets', 'postpaidProviders'):
            for acc in result.get(f, []):
                acc_name = str(acc.get('name', '')).strip()
                if acc_name and key(acc_name) not in {key(c) for c in couriers}:
                    couriers.append(acc_name)

    courier_keys = {key(c) for c in couriers}

    for field in ('prepaidWallets', 'postpaidProviders'):
        accounts = [dict(account) for account in result.get(field, []) if account.get('name')]
        existing_map = {key(acc['name']): acc for acc in accounts}

        synced_accounts = []
        for carrier in couriers:
            k = key(carrier)
            if k in existing_map:
                synced_accounts.append(existing_map[k])
            else:
                account = {'name': carrier}
                if field == 'prepaidWallets':
                    account.update(openingBalance=0.0, currency='INR')
                else:
                    account.update(deposit=0.0, paymentTerms='30 Days', accountNo='')
                synced_accounts.append(account)
        result[field] = synced_accounts

    result['couriers'] = couriers
    return result


