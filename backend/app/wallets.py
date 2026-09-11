"""Persist running balances in chronological wallet ledger order."""
from app.models import SystemSettings, WalletTransaction


def rebuild_wallet_balances(db, wallet):
    settings = db.query(SystemSettings).with_for_update().first()
    configs = settings.config_json.get('prepaidWallets', []) if settings else []
    opening = next((float(item.get('openingBalance', 0)) for item in configs if item['name'] == wallet), 0.0)
    db.flush()
    rows = db.query(WalletTransaction).filter(WalletTransaction.wallet == wallet).order_by(WalletTransaction.date, WalletTransaction.created_at, WalletTransaction.id).with_for_update().all()
    balance = opening
    for row in rows:
        balance = round(balance + (row.amount if row.type == 'recharge' else -row.amount), 2)
        row.balance_after = balance
    return balance
