// Preview the in-memory bill against server-provided thresholds without saving a draft.
export function previewPosProgress(progress,amount) {
  if(!progress)return null;
  const bill=Math.max(0,Number(Number(amount || 0).toFixed(2)));
  const percent=(value,goal)=>goal<=0?100:Math.max(0,Math.min(100,Number((value*100/goal).toFixed(2))));
  const milestone=value=>{
    if(!value)return value;
    const goal=Number(value.goal || 0),completed=Number(value.completedAmount || 0);
    const projected=Number((completed+bill).toFixed(2)),remaining=Number(Math.max(0,goal-projected).toFixed(2));
    const completedPercent=percent(completed,goal);
    return {...value,projectedAmount:projected,remaining,completedPercent,billPercent:Number(Math.max(0,percent(projected,goal)-completedPercent).toFixed(2)),state:completed>=goal?'ACHIEVED':remaining===0?'WITH_BILL':'IN_PROGRESS'};
  };
  return {...progress,currentBillAmount:bill,projectedMonthlyPurchases:Number((Number(progress.monthlyPurchases || 0)+bill).toFixed(2)),
    nextRange:milestone(progress.nextRange),ranges:(progress.ranges || []).map(milestone),
    targets:(progress.targets || []).map(target=>({...target,milestones:(target.milestones || []).map(milestone)}))};
}
