import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createServer} from 'vite';import {Window} from 'happy-dom';
async function fixture(run){const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});try{await run({window,host,root,server});}finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}}
test('range popup combines ranges and targets in one card and ignores the unsent bill',()=>fixture(async({window,root,server})=>{
 const {default:Progress}=await server.ssrLoadModule('/src/components/PosRangeProgress.jsx');const level=(name,state='IN_PROGRESS')=>({name,state,goal:100,completedAmount:state==='ACHIEVED'?100:50,remaining:45,completedPercent:50,billPercent:5,projectedAmount:55});
 const progress={periodStart:'2026-10-01',periodEnd:'2026-10-31',currentRangeName:'Silver',monthlyPurchases:50,currentBillAmount:5,projectedMonthlyPurchases:55,ranges:[level('Reached','ACHIEVED'),...Array.from({length:12},(_,i)=>level(`Range ${i+1}`))],targets:[{name:'October campaign',endDate:'2026-10-31',milestones:[{...level('Reward goal'),reward:'5% discount'}]}]};
 await act(async()=>root.render(React.createElement(Progress,{customer:{id:1,name:'Customer'},progress,onClose:()=>{}})));
 assert.equal(document.querySelectorAll('.pos-range-card').length,1);
 assert.equal(document.querySelector('[aria-label="Range or target"]'),null);
 assert.equal(document.querySelectorAll('.pos-milestone').length,3);
 assert.match(document.querySelector('.pos-range-card-summary').textContent,/50.00/);
 assert.doesNotMatch(document.body.textContent,/Current bill|sent to the warehouse|before.*adjust/);
 const next=document.querySelector('[aria-label="Next goal"]');
 while(!next.disabled)await act(async()=>next.click());
 assert.match(document.body.textContent,/October campaign/);assert.match(document.body.textContent,/5% discount/);
 const reward=[...document.querySelectorAll('.pos-milestone')].find(row=>row.textContent.includes('Reward goal'));
 assert.match(reward.textContent,/Remaining Rs. 50.00/);
 assert.equal(reward.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),'50');
 const {salesApi}=await server.ssrLoadModule('/src/api/apiClient.js');let requested;
 salesApi.getPosProgress=async params=>{requested=params;return {data:{...progress,periodStart:'2026-09-01',periodEnd:'2026-09-30',monthlyPurchases:25}};};
 const month=document.querySelector('[aria-label="Range month"]');assert.equal(month.tagName,'BUTTON');
 await act(async()=>month.click());
 await act(async()=>document.querySelector('[aria-label="September 2026"]').click());
 assert.deepEqual(requested,{customerId:1,month:'2026-09'});
 assert.match(document.querySelector('.pos-range-card-summary').textContent,/25.00/);

}));
test('staff performance keeps a compact month filter, ranked rows and staff details',()=>fixture(async({window,host,root,server})=>{
 const {salesApi}=await server.ssrLoadModule('/src/api/apiClient.js');const {default:Performance}=await server.ssrLoadModule('/src/components/PosStaffPerformance.jsx');
 const requestedMonths=[]; salesApi.getPosStaffPerformance=async(params)=>{requestedMonths.push(params.month);return ({data:{periodStart:'2026-10-01',periodEnd:'2026-10-31',teamAmount:1500,teamBillCount:15,rangeMilestones:4,staff:Array.from({length:9},(_,i)=>({rank:i+1,username:`staff${i+1}`,fullName:`Staff ${i+1}`,originalAmount:1500-i*100,billCount:15-i,rangeMilestones:1,customerCount:2,pendingPrintCount:0,averageBillAmount:100,gapToNext:i?100:0,confirmedAmount:300,customers:[{id:9,name:"Kandy Retail",code:"CUST-9",billCount:2,originalAmount:200,range:"Gold",monthlyAmount:600}],customerRanges:[{name:"Gold",customers:1}],targetAchievements:[{customerId:9,customerName:"Kandy Retail",target:"October campaign",milestone:"Sales goal",goal:500,achievedOn:"2026-10-20"}]}))}});};
 await act(async()=>root.render(React.createElement(Performance,{user:{username:'staff2'}})));
 assert.equal(host.querySelector('.pos-performance-spotlight'),null);assert.equal(host.querySelector('[aria-label="Find POS staff"]'),null);assert.equal(host.querySelectorAll('tbody tr').length,8);
 assert.equal(host.querySelector('[aria-label="Performance month"]').tagName,'BUTTON');
 await act(async()=>host.querySelector('[aria-label="Performance month"]').click());
 await act(async()=>document.querySelector('[aria-label="September 2026"]').click());
 assert.equal(requestedMonths.at(-1),'2026-09');
 await act(async()=>host.querySelector('[aria-label="Next staff page"]').click());assert.equal(host.querySelectorAll('tbody tr').length,1);assert.match(host.querySelector('tbody').textContent,/#9/);
 await act(async()=>host.querySelector('[aria-label="View performance for Staff 9"]').click());
 const details=document.querySelector('[aria-label="Staff performance details"]');assert.ok(details);
 assert.match(details.textContent,/Gold/);assert.match(details.textContent,/Rs. 100.00 to match rank #8/);
 assert.equal(details.querySelector('[aria-label="Search staff results"]'),null);
 assert.doesNotMatch(details.textContent,/Kandy Retail|Average bill|awaiting print/);
 assert.ok(host.querySelector('.pos-performance-table'),'Rankings remain behind the compact staff popup');
 await act(async()=>details.querySelector('[aria-label="Close staff performance"]').click());
 assert.equal(document.querySelector('[aria-label="Staff performance details"]'),null);
 assert.ok(host.querySelector('[aria-label="Performance month"]'));

}));
