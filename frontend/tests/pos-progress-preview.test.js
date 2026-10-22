import test from 'node:test';
import assert from 'node:assert/strict';
import {previewPosProgress} from '../src/utils/posProgressPreview.js';
test('in-memory POS previews monthly and campaign goals without writing a draft',()=>{
 const progress={monthlyPurchases:100,nextRange:{goal:500,completedAmount:100},ranges:[{goal:0,completedAmount:100},{goal:500,completedAmount:100}],targets:[{milestones:[{goal:1000,completedAmount:800,reward:'Reward'}]}]};
 const preview=previewPosProgress(progress,250);
 assert.equal(preview.currentBillAmount,250);assert.equal(preview.projectedMonthlyPurchases,350);
 assert.equal(preview.nextRange.remaining,150);assert.equal(preview.nextRange.completedPercent,20);assert.equal(preview.nextRange.billPercent,50);
 assert.equal(preview.ranges[0].state,'ACHIEVED');assert.equal(preview.targets[0].milestones[0].state,'WITH_BILL');
 assert.equal(preview.targets[0].milestones[0].reward,'Reward');assert.equal(progress.nextRange.projectedAmount,undefined);
 assert.equal(previewPosProgress(progress,0).nextRange.billPercent,0);assert.equal(previewPosProgress(null,1),null);
});
