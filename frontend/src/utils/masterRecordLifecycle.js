export const masterTypes=['products','warehouses','brands','categories'];
export const masterNames={products:'Product',warehouses:'Warehouse',brands:'Brand',categories:'Category'};
export const recordStatus=record=>record?.status || ((record?.isActive ?? record?.active)?'ACTIVE':'INACTIVE');
export const hasMasterDraftInput=(type,form)=>[type==='products'?'sku':'code','name','description','remarks',...(type==='products'?['brandId','categoryId','warehouseId']:type==='warehouses'?['address','contactNumber','phone']:[])].some(key=>String(form[key] ?? '').trim());
