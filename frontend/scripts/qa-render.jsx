import React from 'react';
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
    fs.writeFileSync('../qa-results/frontend-render-results.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
    if(results.some(r=>!r.passed)) throw new Error('Frontend rendering checks failed');
}
