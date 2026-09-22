export const ROLES = {
    super_admin: {
        id: 'super_admin',
        name: 'Super Admin',
        badge: 'badge-danger',
        description: 'Full Access (Financials, Cost Margins, Reconciliation, Settings, Staff Approvals)',
        permissions: {
            viewFinancials: true,
            viewCostMargins: true,
            addShipment: true,
            editShipment: true,
            deleteShipment: true,
            approveRefunds: true,
            manageAccounts: true,
            runReconciliation: true,
            exportReports: true,
            manageSettings: true,
            manageUsers: true
        }
    },
    operations_staff: {
        id: 'operations_staff',
        name: 'Operations Staff',
        badge: 'badge-primary',
        description: 'Operational Bookings, Customer 360, Tracking (Financial Margins Masked)',
        permissions: {
            viewFinancials: false,
            viewCostMargins: false,
            addShipment: true,
            editShipment: true,
            deleteShipment: false,
            approveRefunds: false,
            manageAccounts: false,
            runReconciliation: false,
            exportReports: true,
            manageSettings: false,
            manageUsers: false
        }
    },
    counter_staff: {
        id: 'counter_staff',
        name: 'Front Counter Staff',
        badge: 'badge-warning',
        description: 'Counter Shipment Entry & Receipts (Restricted Operations)',
        permissions: {
            viewFinancials: false,
            viewCostMargins: false,
            addShipment: true,
            editShipment: false,
            deleteShipment: false,
            approveRefunds: false,
            manageAccounts: false,
            runReconciliation: false,
            exportReports: false,
            manageSettings: false,
            manageUsers: false
        }
    }
};


ROLES.manager = { id: 'manager', name: 'Manager', badge: 'badge-primary', permissions: {} };
ROLES.team_leader = { id: 'team_leader', name: 'Team Leader', badge: 'badge-primary', permissions: {} };
ROLES.operations_executive = { id: 'operations_executive', name: 'Operations Executive', badge: 'badge-primary', permissions: {} };
ROLES.counter_staff.name = 'Counter Staff';
