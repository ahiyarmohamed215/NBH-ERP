// Creation time, rather than document date or last edit time, controls list order.
export function newestFirst(records) {
  const created=record=>{const value=Date.parse(record.createdAt || '');return Number.isFinite(value)?value:0;};
  return [...records].sort((left,right)=>created(right)-created(left) || Number(right.id || 0)-Number(left.id || 0));
}
