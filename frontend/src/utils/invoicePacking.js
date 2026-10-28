export const packingFields=[['boxes','Box'],['bags','Bag'],['pBags','P. Bag'],['others','Others']];
export const emptyPacking=()=>Object.fromEntries(packingFields.map(([key])=>[key,'0']));
export const validPacking=value=>packingFields.every(([key])=>/^\d+$/.test(String(value?.[key] ?? '')) && Number(value[key])<=1000000);
export const packingTotals=rows=>Object.fromEntries(packingFields.map(([key])=>[key,Object.values(rows).reduce((sum,row)=>sum+(Number(row[key]) || 0),0)]));
