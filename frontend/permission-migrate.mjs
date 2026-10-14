import fs from 'node:fs';import {parse} from '@babel/parser';
const configs={InventoryHub:['inventory','currentTab','user','inventory-list','activeSubTab'],InvoicingHub:['invoicing','currentTab','user','sales','activeSubTab'],PaymentsHub:['payments','currentTab','user','payments','activeSubTab'],PurchasingHub:['purchasing','currentTab','user','suppliers','activeSubTab'],EmployeesHub:['employees','activeTab','currentUser','list','resolveTab(activeSubTab)'],CustomersHub:['customers','activeTab','user','list',"activeSubTab === 'routes' ? 'groups' : activeSubTab === 'ranges' ? 'targets' : activeSubTab"],DeliveryHub:['delivery','currentTab','user','deliveries','activeSubTab'],ReportsView:['reports','currentPrimaryTab','user','customer-reports','activeSubTab']};
for(const [view,[module,state,user,fallback,requested]]of Object.entries(configs)){
 const path=`src/views/${view}.jsx`;let s=fs.readFileSync(path,'utf8');const ast=parse(s,{sourceType:'module',plugins:['jsx']}),edits=[];let navIndex=0;
 function walk(n,anc=[]){if(!n||typeof n!=='object')return;
  if(n.type==='VariableDeclarator'&&n.id.type==='ArrayPattern'&&n.id.elements[0]?.name===state){edits.push({start:n.init.start,end:n.init.end,text:`useModuleTab('${module}',${requested},'${fallback}',${user})`});}
  if(n.type==='JSXElement'&&n.openingElement.name.name==='ErpTabs'){
   navIndex++;if(navIndex===1)edits.push({start:n.openingElement.name.end,end:n.openingElement.name.end,text:` module="${module}"`});
  }
  if(n.type==='JSXElement'&&n.openingElement.name.name==='ErpTab'){
   const opening=n.openingElement,active=opening.attributes.find(a=>a.name?.name==='data-active');
   const text=active?s.slice(active.start,active.end):'';
   const literal=text.match(/===\s*'([^']+)'/);
   if(literal)edits.push({start:opening.name.end,end:opening.name.end,text:` tabId="${literal[1]}"`});
   else if(navIndex===1)edits.push({start:opening.name.end,end:opening.name.end,text:' tabId={tab.id}'});
  }
  for(const[k,v]of Object.entries(n))if(k!=='loc'&&k!=='extra')if(Array.isArray(v))v.forEach(x=>walk(x,[...anc,n]));else if(v&&typeof v==='object')walk(v,[...anc,n]);
 }walk(ast);
 for(const e of edits.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.text+s.slice(e.end);
 s="import useModuleTab from '../hooks/useModuleTab';\n"+s;
 if(view==='ReportsView'){s="import {useAuth} from '../context/AuthContext';\n"+s;s=s.replace("export default function ReportsView({ activeSubTab = 'customer-reports', onSubTabChange }) {","export default function ReportsView({ activeSubTab = 'customer-reports', onSubTabChange }) {\n  const {user}=useAuth();");}
 fs.writeFileSync(path,s);
}
