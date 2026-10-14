import fs from 'node:fs';import {parse} from '@babel/parser';
const configs={InventoryHub:['inventory','currentTab','user'],InvoicingHub:['invoicing','currentTab','user'],PaymentsHub:['payments','currentTab','user'],PurchasingHub:['purchasing','currentTab','user'],EmployeesHub:['employees','activeTab','currentUser'],CustomersHub:['customers','activeTab','user'],DeliveryHub:['delivery','currentTab','user']};
for(const[view,[module,state,user]]of Object.entries(configs)){
 const path=`src/views/${view}.jsx`;let s=fs.readFileSync(path,'utf8');const ast=parse(s,{sourceType:'module',plugins:['jsx']}),edits=[];
 function walk(n,inHeader=false){if(!n||typeof n!=='object')return;
  if(n.type==='JSXElement'){
   const attrs=n.openingElement.attributes,cls=attrs.find(a=>a.name?.name==='className');if(cls&&s.slice(cls.start,cls.end).includes('erp-page-header'))inHeader=true;
   if(inHeader&&n.openingElement.name.name==='button'){
    const content=s.slice(n.start,n.end),transfer=content.includes("'gtn'");const condition=transfer?`!hasPermission(${user},'GTN_PROCESS')`:`!canWriteTab(${user},'${module}',${state})`;
    const disabled=attrs.find(a=>a.name?.name==='disabled');
    if(disabled){const existing=s.slice(disabled.value.expression.start,disabled.value.expression.end);edits.push({start:disabled.start,end:disabled.end,text:`disabled={${condition} || (${existing})}`});}
    else edits.push({start:n.openingElement.name.end,end:n.openingElement.name.end,text:` disabled={${condition}}`});
   }
  }
  for(const[k,v]of Object.entries(n))if(k!=='loc'&&k!=='extra')if(Array.isArray(v))v.forEach(x=>walk(x,inHeader));else if(v&&typeof v==='object')walk(v,inHeader);
 }walk(ast);for(const e of edits.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.text+s.slice(e.end);
 if(edits.length)s="import {canWriteTab,hasPermission} from '../utils/moduleAccess';\n"+s;
 fs.writeFileSync(path,s);
}
for(const[view,permission]of [['GtnView','GTN_PROCESS'],['PrnView','PRN_PROCESS'],['PurchaseOrdersView','SUPPLIER_MANAGE']]){
 const path=`src/views/${view}.jsx`;let s=fs.readFileSync(path,'utf8');const ast=parse(s,{sourceType:'module',plugins:['jsx']}),edits=[];
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='JSXElement'){
   const attrs=n.openingElement.attributes;
   if(n.openingElement.name.name==='PurchaseInspectionModal'){
    const action=attrs.find(a=>a.name?.name==='actions');if(action?.value?.expression){const ex=action.value.expression;edits.push({start:ex.start,end:ex.end,text:`canManage ? (${s.slice(ex.start,ex.end)}) : []`});}
   }
   if(n.openingElement.name.name==='button'){
    const title=attrs.find(a=>a.name?.name==='title');
    if(title&&s.slice(title.start,title.end).includes('Edit ')&&!attrs.some(a=>a.name?.name==='disabled'))edits.push({start:n.openingElement.name.end,end:n.openingElement.name.end,text:' disabled={!canManage}'});
   }
  }
  if(n.type==='VariableDeclarator'&&n.id.name==='canManage')throw Error('Already migrated');
  for(const[k,v]of Object.entries(n))if(k!=='loc'&&k!=='extra')if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);
 }walk(ast);for(const e of edits.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.text+s.slice(e.end);
 const marker=`const ${view} = React.forwardRef(function ${view}(props, ref) {`;
 if(s.includes(marker))s=s.replace(marker,marker+`\n  const auth=useAuth();\n  const canManage=hasPermission(auth?.user,'${permission}');`);
 else {const marker=s.match(/(?:export default function|function) PurchaseOrdersView\([^\n]*\) \{/);if(!marker)throw Error('Unknown component');s=s.replace(marker[0],marker[0]+`\n  const auth=useAuth();\n  const canManage=hasPermission(auth?.user,'${permission}');`);}
 s="import {useAuth} from '../context/AuthContext';\nimport {hasPermission} from '../utils/moduleAccess';\n"+s;fs.writeFileSync(path,s);
}
