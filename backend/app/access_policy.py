"""One effective-permission resolver for login, API requests and access previews."""
from app.models import UserPermissionOverride

ROLE_NAMES = {'super_admin': 'SUPER_ADMIN', 'manager': 'Manager', 'team_leader': 'Team Leader',
              'counter_staff': 'Counter Staff', 'operations_executive': 'Operations Executive'}
ROLE_ALIASES = {'operations_staff': 'operations_executive', 'operations staff': 'operations_executive',
                'front counter staff': 'counter_staff', 'center manager': 'manager'}
SUPER_ONLY = set()
COMMON = {'dashboards.view', 'customers.view', 'shipments.view', 'invoices.view', 'search.global',
          'followups.view', 'followups.add', 'followups.edit', 'refunds.view', 'refunds.request', 'settings.view',
          'attendance.view', 'attendance.punch'}

ROLE_DEFAULTS = {
    'manager': COMMON | {
        'customers.add', 'customers.edit', 'customers.export', 'customers.delete', 'customers.statement',
        'shipments.add', 'shipments.edit', 'shipments.cancel', 'shipments.export', 'shipments.delete',
        'invoices.add', 'invoices.edit', 'invoices.export', 'invoices.print',
        'accounts.view', 'accounts.edit', 'accounts.reconcile', 'accounts.export',
        'refunds.approve', 'refunds.process',
        'reports.view', 'reports.eod', 'reports.weekly', 'reports.custom_range', 'reports.print', 'reports.export',
        'b2b.view', 'b2b.add', 'b2b.edit', 'b2b.manage_credit', 'b2b.export',
        'users.view', 'users.invite', 'users.edit', 'users.suspend',
        'settings.manage',
        'reconciliation.view', 'reconciliation.run',
    },
    'team_leader': COMMON | {
        'customers.add', 'customers.edit', 'customers.export', 'customers.statement',
        'shipments.add', 'shipments.edit', 'shipments.cancel', 'shipments.export',
        'invoices.add', 'invoices.edit', 'invoices.export', 'invoices.print',
        'refunds.approve',
        'reports.view', 'reports.eod', 'reports.weekly', 'reports.custom_range', 'reports.print', 'reports.export',
        'b2b.view', 'b2b.add', 'b2b.edit',
        'accounts.view', 'accounts.reconcile',
        'reconciliation.view',
        'users.view',
    },
    'counter_staff': COMMON | {
        'customers.add', 'customers.edit', 'customers.statement',
        'shipments.add', 'shipments.edit', 'shipments.cancel', 'shipments.export',
        'invoices.add', 'invoices.edit', 'invoices.export', 'invoices.print',
        'reports.eod',
        'b2b.view',
    },
    'operations_executive': COMMON | {
        'customers.add', 'customers.edit',
        'shipments.add', 'shipments.edit', 'shipments.cancel', 'shipments.export',
        'reports.view', 'reports.eod', 'reports.weekly', 'reports.custom_range', 'reports.print', 'reports.export',
        'reconciliation.view',
    },
}

def role_code(profile):
    names = [r.name for r in profile.roles]
    if profile.role == 'super_admin' or 'SUPER_ADMIN' in names:
        return 'super_admin'
    for name in names + [profile.role]:
        key = name.lower().replace(' ', '_')
        if key in ROLE_NAMES:
            return key
        if name.lower() in ROLE_ALIASES:
            return ROLE_ALIASES[name.lower()]
    return profile.role

def resolve_permissions(db, profile, include_overrides=True):
    if role_code(profile) == 'super_admin':
        return {'*': 'all'}
    result = {}
    rank = {'own': 1, 'center': 2, 'all': 3}
    for role in profile.roles:
        for mapping in role.permissions:
            if mapping.permission_rel:
                code = mapping.permission_rel.code
                if rank.get(mapping.scope, 0) > rank.get(result.get(code), 0):
                    result[code] = mapping.scope
    # Defaults are seeded onto roles; do not restore permissions an admin removed.
    if include_overrides:
        for override in db.query(UserPermissionOverride).filter_by(user_id=profile.id):
            if override.allowed:
                # Overrides never expand assigned-center access.
                result[override.permission_code] = 'center'
                if override.permission_code == 'costs.carrier_cost':
                    result['costs.view'] = 'center'
                elif override.permission_code == 'costs.view':
                    result['costs.carrier_cost'] = 'center'
                elif override.permission_code == 'costs.net_value':
                    result['reports.view_financial'] = 'center'
                elif override.permission_code == 'reports.view_financial':
                    result['costs.net_value'] = 'center'
            else:
                result.pop(override.permission_code, None)
                if override.permission_code in ('costs.carrier_cost', 'costs.view'):
                    result.pop('costs.carrier_cost', None)
                    result.pop('costs.view', None)
                elif override.permission_code in ('costs.net_value', 'reports.view_financial'):
                    result.pop('costs.net_value', None)
                    result.pop('reports.view_financial', None)
        denied_cost = db.query(UserPermissionOverride).filter(
            UserPermissionOverride.user_id == profile.id,
            UserPermissionOverride.permission_code.in_(['costs.view', 'costs.carrier_cost']),
            UserPermissionOverride.allowed == False
        ).first()
        if denied_cost:
            result.pop('reports.view_financial', None)
            result.pop('costs.net_value', None)

    # Explicit denials win across equivalent names, regardless of database order.
    if include_overrides:
        denied = {row.permission_code for row in db.query(UserPermissionOverride).filter_by(user_id=profile.id, allowed=False)}
        for aliases in ({'costs.carrier_cost', 'costs.view'}, {'costs.net_value', 'reports.view_financial'}):
            if aliases & denied:
                for code in aliases:
                    result.pop(code, None)

    # Sync aliases in resolved permissions
    if 'costs.carrier_cost' in result:
        result.setdefault('costs.view', result['costs.carrier_cost'])
    elif 'costs.view' in result:
        result.setdefault('costs.carrier_cost', result['costs.view'])

    if 'costs.net_value' in result:
        result.setdefault('reports.view_financial', result['costs.net_value'])
    elif 'reports.view_financial' in result:
        result.setdefault('costs.net_value', result['reports.view_financial'])

    for code in SUPER_ONLY | {'*'}:
        result.pop(code, None)
    return result

def can_view_customer_price(ctx):
    if not ctx:
        return False
    perms = ctx.get('permissions', {})
    return bool(ctx.get('is_super_admin') or '*' in perms or perms.get('costs.customer_price') or perms.get('pricing.customer_price'))

def can_view_costs(ctx):
    if not ctx:
        return False
    perms = ctx.get('permissions', {})
    return bool(ctx.get('is_super_admin') or '*' in perms or perms.get('costs.carrier_cost') or perms.get('costs.view'))

def can_view_carrier_cost(ctx):
    return can_view_costs(ctx)

def can_view_values(ctx):
    if not ctx:
        return False
    perms = ctx.get('permissions', {})
    return bool(ctx.get('is_super_admin') or '*' in perms or perms.get('costs.net_value') or perms.get('reports.view_financial'))

def can_view_net_value(ctx):
    return can_view_values(ctx)

def can_view_margins(ctx):
    if not ctx:
        return False
    perms = ctx.get('permissions', {})
    return bool(ctx.get('is_super_admin') or '*' in perms or perms.get('costs.margins') or perms.get('costs.margin'))


