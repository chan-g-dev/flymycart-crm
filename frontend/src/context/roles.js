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
    manager: {
        id: 'manager',
        name: 'Manager',
        badge: 'badge-primary',
        description: 'Branch Management & Full Operational Control (Excludes Margin & Profit)',
        permissions: {
            viewFinancials: true,
            viewCostMargins: false,
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
    supervisor: {
        id: 'supervisor',
        name: 'Supervisor',
        badge: 'badge-purple',
        description: 'Operational Supervision, Dispatch Routing, Team Escalations & Daily EOD Sheets',
        permissions: {
            viewFinancials: false,
            viewCostMargins: false,
            addShipment: true,
            editShipment: true,
            deleteShipment: false,
            approveRefunds: true,
            manageAccounts: false,
            runReconciliation: true,
            exportReports: true,
            manageSettings: false,
            manageUsers: false
        }
    },
    account_executive: {
        id: 'account_executive',
        name: 'Account Executive',
        badge: 'badge-warning',
        description: 'Billing, Invoices, Carrier Value Auditing, Ledger Settlement & Bank Reconciliation',
        permissions: {
            viewFinancials: true,
            viewCostMargins: false,
            addShipment: true,
            editShipment: true,
            deleteShipment: false,
            approveRefunds: false,
            manageAccounts: true,
            runReconciliation: true,
            exportReports: true,
            manageSettings: false,
            manageUsers: false
        }
    },
    operation_executive: {
        id: 'operation_executive',
        name: 'Operation Executive',
        badge: 'badge-info',
        description: 'Counter Shipment Entry, Volumetric Weighing, AWB Tracking & Label Printing',
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
    }
};

// Aliases for backward compatibility
ROLES.operations_executive = ROLES.operation_executive;
ROLES.operations_staff = ROLES.operation_executive;
ROLES.team_leader = ROLES.supervisor;
ROLES.counter_staff = ROLES.account_executive;
