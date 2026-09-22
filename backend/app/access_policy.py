"""One effective-permission resolver for login, API requests and access previews."""
from app.models import UserPermissionOverride

ROLE_NAMES = {'super_admin': 'SUPER_ADMIN', 'manager': 'Manager', 'team_leader': 'Team Leader',
              'counter_staff': 'Counter Staff', 'operations_executive': 'Operations Executive'}
ROLE_ALIASES = {'operations_staff': 'operations_executive', 'operations staff': 'operations_executive',
                'front counter staff': 'counter_staff', 'center manager': 'manager'}
SUPER_ONLY = {'users.invite', 'users.edit', 'users.suspend', 'users.manage_permissions',
              'settings.manage'}
COMMON = {'dashboards.view', 'customers.view', 'shipments.view', 'invoices.view', 'search.global',
          'followups.view', 'followups.add', 'followups.edit', 'refunds.view', 'refunds.request', 'settings.view'}
ROLE_DEFAULTS = {
    'manager': COMMON | {'customers.add', 'customers.edit', 'customers.export', 'shipments.add',
        'shipments.edit', 'shipments.cancel', 'shipments.export', 'invoices.add', 'invoices.edit',
        'invoices.export', 'accounts.view', 'accounts.export', 'reports.view', 'reports.export',
        'b2b.view', 'b2b.add', 'b2b.edit', 'users.view'},
    'team_leader': COMMON | {'customers.add', 'customers.edit', 'shipments.add', 'shipments.edit',
        'invoices.add', 'reports.view', 'b2b.view'},
    'counter_staff': COMMON | {'customers.add', 'shipments.add', 'invoices.add', 'invoices.edit'},
    'operations_executive': COMMON | {'shipments.edit', 'reports.view'},
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
    if include_overrides:
        for override in db.query(UserPermissionOverride).filter_by(user_id=profile.id):
            if override.allowed:
                # Overrides never expand assigned-center access.
                result[override.permission_code] = 'center'
            else:
                result.pop(override.permission_code, None)
                if override.permission_code == 'costs.view':
                    # Value + sale would reveal purchase cost indirectly.
                    result.pop('reports.view_financial', None)
        denied_cost = db.query(UserPermissionOverride).filter_by(user_id=profile.id, permission_code='costs.view', allowed=False).first()
        if denied_cost:
            result.pop('reports.view_financial', None)
    for code in SUPER_ONLY | {'*'}:
        result.pop(code, None)
    return result

def can_view_values(ctx):
    return bool(ctx.get('is_super_admin') or ctx.get('permissions', {}).get('*') or ctx.get('permissions', {}).get('reports.view_financial'))

def can_view_costs(ctx):
    return can_view_values(ctx) or bool(ctx.get('permissions', {}).get('costs.view'))
