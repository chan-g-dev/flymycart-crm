import CustomerTypesSettings from '../src/components/CustomerTypesSettings';
import CustomerModal from '../src/components/CustomerModal';
import ShipmentModal from '../src/components/ShipmentModal';
import useTablePage from '../src/components/useTablePage';
﻿import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthContext } from '../src/context/authSession';
import { Dashboard } from '../src/pages/Dashboard';
import { Customers, Shipments } from '../src/pages/CustomersAndShipments';
import { Invoices, Accounts, B2B } from '../src/pages/InvoicesAccountsB2B';
import { Refunds } from '../src/pages/Refunds';
import { Followups } from '../src/pages/Followups';
import { Reports } from '../src/pages/Reports';
import { Settings } from '../src/pages/Settings';
import { Users } from '../src/pages/UsersSection';
import { Attendance } from '../src/pages/Attendance';
import RolePermissionEditor from '../src/components/RolePermissionEditor';
import { ExpenseEntry } from '../src/components/AccountsForms';
import fs from 'node:fs';
export function run() {
    const data=JSON.parse(fs.readFileSync('../qa-results/frontend-fixtures.json','utf8'));
    const roles=['super_admin','manager'];
    const results=[];
    for (const role of roles) {
        const context={currentUser:{name:'QA Tester',email:'qa@example.test',roleId:role,isSuperAdmin:role==='super_admin'},currentRole:{id:role},hasPermission:code=> role==='super_admin' || ['dashboards.view','customers.view','shipments.view','invoices.view','accounts.view','reports.view','users.view','settings.view'].includes(code)};
        const cases=[['Dashboard',Dashboard,{data:data.dashboard,shipments:data.shipments,accountsData:data.accounts,b2bData:data.b2b}],['Customers',Customers,{customers:data.customers}],['Shipments',Shipments,{shipments:data.shipments,settings:data.settings}],['Invoices',Invoices,{invoices:data.invoices}],['Accounts',Accounts,{accountsData:data.accounts,settings:data.settings,reconciliations:[],activeSection:'overview'}],['B2B',B2B,{b2bData:data.b2b}],['Refunds',Refunds,{refunds:data.refunds}],['Followups',Followups,{followups:data.followups,customers:data.customers}],['Reports',Reports,{}],['Settings',Settings,{settings:data.settings}],['Users',Users,{settings:data.settings}]];
        cases.push(['Attendance', Attendance, {settings: data.settings}]);
        if(role==='super_admin') cases.push(['ExpenseEntry',ExpenseEntry,{settings:data.settings,accounts:['QA Cash'],providers:data.accounts.postpaid_accounts}],['RoleEditor',RolePermissionEditor,{role:{name:'Manager',permissions:[]}}]);
        for(const [name,Component,props] of cases) {
            try {
                const html=renderToStaticMarkup(<AuthContext.Provider value={context}><Component {...props}/></AuthContext.Provider>);
                if(!html.length) throw new Error('Empty render');
                if(role==='manager' && name==='Dashboard' && html.includes('Carrier Cost &amp; Value')) throw new Error('Financial card visible to manager');
                if(role==='manager' && name==='Shipments' && html.includes('Value After Courier Cost')) throw new Error('Financial column visible to manager');
                results.push({screen:name,role,passed:true});
            } catch(e) { results.push({screen:name,role,passed:false,error:e.message}); }
        }
    }
    // Large directories must remain complete in memory while rendering one bounded page.
    const context = { currentUser: { roleId: 'super_admin', isSuperAdmin: true }, hasPermission: () => true };
    for (const [name, Component, key, sample] of [
        ['Customers', Customers, 'customers', data.customers[0]],
        ['Shipments', Shipments, 'shipments', data.shipments[0]],
        ['Invoices', Invoices, 'invoices', data.invoices[0]],
    ]) {
        const rows = Array.from({ length: 1200 }, (_, i) => ({ ...sample, id: `performance-${i}` }));
        const start = performance.now();
        try {
            const html = renderToStaticMarkup(<AuthContext.Provider value={context}><Component {...{ [key]: rows, settings: data.settings }} /></AuthContext.Provider>);
            const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
            if ((body.match(/<tr[ >]/g) || []).length !== 50) throw new Error('Expected exactly 50 rendered rows');
            if (!html.includes('of 1200') || !html.includes('Page ') || !html.includes('Next')) throw new Error('Remaining records are not reachable through pagination');
            if (rows.length !== 1200) throw new Error('Pagination mutated the complete directory');
            results.push({ screen: name, dataset: 1200, renderedRows: 50, passed: true, renderMs: Math.round(performance.now() - start) });
        } catch (error) { results.push({ screen: name, dataset: 1200, passed: false, error: error.message }); }
    }
    function PaginationTransitions() {
        const [step, setStep] = React.useState(0);
        const rows = Array.from({ length: step >= 4 ? 3 : 1200 }, (_, id) => ({ id }));
        const page = useTablePage(rows, step >= 2 ? 'filtered' : 'all');
        if (step === 0) { page.setPage(24); setStep(1); }
        if (step === 1) {
            if (page.page !== 24 || page.rows[0].id !== 1150) throw new Error('Later pages are inaccessible');
            setStep(2);
        }
        if (step === 2) {
            if (page.page !== 1) throw new Error('New filters must reset to the first page');
            setStep(3);
        }
        if (step === 3) { page.setPage(24); setStep(4); }
        if (step === 4 && (page.page !== 1 || page.rows.length !== 3)) throw new Error('Shrinking results must clamp to a valid page');
        return <span>Pagination transitions passed</span>;
    }
    try {
        renderToStaticMarkup(<PaginationTransitions />);
        results.push({ screen: 'Pagination transitions: next page, new filter, deleted records', passed: true });
    } catch (error) { results.push({ screen: 'Pagination transitions', passed: false, error: error.message }); }
    const customSettings = { ...data.settings, customerTypes: ['C2C', 'B2C', 'B2B', 'Distributor'] };
    for (const [name, Component, props] of [
        ['Custom type settings', CustomerTypesSettings, { settings: customSettings, canManage: true }],
        ['Custom type customer form', CustomerModal, { isOpen: true, settings: customSettings }],
        ['Custom type booking form', ShipmentModal, { isOpen: true, settings: customSettings }],
        ['Custom type directory', Customers, { settings: customSettings, customers: [{ ...data.customers[0], customer_type: 'Distributor' }] }],
    ]) {
        try {
            const html = renderToStaticMarkup(<AuthContext.Provider value={context}><Component {...props} /></AuthContext.Provider>);
            if (!html.includes('Distributor')) throw new Error('Configured type missing from screen');
            results.push({ screen: name, passed: true });
        } catch (error) { results.push({ screen: name, passed: false, error: error.message }); }
    }
    fs.writeFileSync('../qa-results/frontend-render-results.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
    if(results.some(r=>!r.passed)) throw new Error('Frontend rendering checks failed');
}
