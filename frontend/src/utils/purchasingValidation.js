import {parsePhoneNumberFromString,getCountryCallingCode} from 'libphonenumber-js/max';

export const MAX_NOTES=5000;
export function numberError(value,label,{positive=false,decimals=2,max=Number.MAX_SAFE_INTEGER}={}) {
  if(value === '' || value == null) return `Enter ${label.toLowerCase()}.`;
  let text=String(value).trim();const number=Number(text);
  if(typeof value==='number' && Number.isFinite(number)){const rounded=Number(number.toFixed(decimals));if(Math.abs(number-rounded)<=Number.EPSILON*Math.max(1,Math.abs(number))*4)text=String(rounded);}
  if(!/^(?:\d+\.?\d*|\.\d+)$/.test(text) || !Number.isFinite(number)) return `Enter a valid ${label.toLowerCase()}.`;
  if(positive ? number<=0 : number<0) return `${label} must be ${positive?'greater than zero':'zero or greater'}.`;
  if(number>max) return `${label} is too large.`;
  if((text.split('.')[1] || '').length>decimals) return `${label} supports up to ${decimals} decimal places.`;
  return '';
}
export function dateError(value,label='Date') {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return `Select a valid ${label.toLowerCase()}.`;
  const date=new Date(`${value}T12:00:00Z`);
  return !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value ? `Select a valid ${label.toLowerCase()}.` : '';
}
export function phoneCountry(value) {return parsePhoneNumberFromString(value || '','LK')?.country || 'LK';}
export function phoneError(value,country='LK') {
  if(!String(value || '').trim()) return '';
  if(!/^[+\d\s().-]+$/.test(value) || value.length>30) return 'Enter a valid contact number.';
  const phone=parsePhoneNumberFromString(value,country);
  if(!phone?.isValid() || (phone.country && phone.country!==country)) return `Enter a valid number for the selected country (+${getCountryCallingCode(country)}).`;
  return '';
}
export function normalizePhone(value,country='LK') {return String(value || '').trim() ? parsePhoneNumberFromString(value,country)?.number || value : '';}
export function supplierErrors(form,{draft=false}={}) {
  const errors={},name=String(form.name || '').trim(),email=String(form.email || '').trim();
  if(!name && !draft) errors.name='Enter a supplier name.';
  else if(name && (name.length<2 || name.length>150)) errors.name='Supplier name must contain 2–150 characters.';
  if(String(form.contactPerson || '').length>100) errors.contactPerson='Contact person must be 100 characters or fewer.';
  const phone=phoneError(form.phone,form.phoneCountry || phoneCountry(form.phone));if(phone)errors.phone=phone;
  if(email && (email.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))errors.email='Enter a valid email address (up to 100 characters).';
  if(String(form.address || '').length>MAX_NOTES) errors.address=`Address must be ${MAX_NOTES} characters or fewer.`;
  if(String(form.remarks || '').length>MAX_NOTES) errors.remarks=`Remarks must be ${MAX_NOTES} characters or fewer.`;
  return errors;
}
export function documentErrors(type,form) {
  const errors=[];
  const validId=value=>/^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value)>0;
  for(const key of ['supplierId','warehouseId','sourceWarehouseId','destinationWarehouseId','responsibleStaffId','purchaseOrderId'])if(form[key] && !validId(form[key]))errors.push('Select a valid record from the list.');
  if(String(form.supplierInvoiceNumber || '').length>100)errors.push('Supplier invoice number must be 100 characters or fewer.');
  if(String(form.notes ?? form.remarks ?? '').length>MAX_NOTES)errors.push(`Remarks must be ${MAX_NOTES} characters or fewer.`);
  if(type==='GRN') {
    if(!form.supplierId)errors.push('Select a supplier.');
    const date=dateError(form.grnDate,'GRN date');if(date)errors.push(date);
  }
  if(type==='GTN' && form.dispatchDate){const date=dateError(form.dispatchDate,'Dispatch date');if(date)errors.push(date);}
  if(type==='PRN' && form.returnDate){const date=dateError(form.returnDate,'Return date');if(date)errors.push(date);}
  if(!form.items?.length)errors.push('Add at least one product.');
  for(const [index,item] of (form.items || []).entries()) {
    const prefix=`Item ${index+1}: `;
    for(const key of ['productId','supplierId','warehouseId','sourceWarehouseId','destinationWarehouseId','sourceGrnId'])if(item[key] && !validId(item[key]))errors.push(prefix+'Select a valid record from the list.');
    if(!item.productId)errors.push(prefix+'Select a product.');
    const quantity=item.quantityReceived ?? item.quantityTransferred ?? item.quantityReturned ?? item.quantity;
    const quantityError=numberError(quantity,'Quantity',{positive:true,decimals:type==='PO'?3:2,max:type==='PO'?999999999999.999:Number.MAX_SAFE_INTEGER});if(quantityError)errors.push(prefix+quantityError);
    if(type!=='GTN') {const cost=numberError(type==='GRN' && Number.isFinite(Number(item.unitCost)) ? Number(item.unitCost).toFixed(8) : item.unitCost,'Unit cost',{decimals:type==='PO'?2:type==='GRN'?8:6,max:type==='PO'?9999999999999.99:Number.MAX_SAFE_INTEGER});if(cost)errors.push(prefix+cost);}
    if(type==='GRN') {const price=numberError(item.salePrice ?? item.sellingPrice,'Selling price');if(price)errors.push(prefix+price);if(item.markupPercent!=null && (!Number.isFinite(Number(item.markupPercent)) || Number(item.markupPercent)<-100 || Number(item.markupPercent)>99999))errors.push(prefix+'MP% must be between -100 and 99999.');}
    if(type==='GTN' && (!(item.sourceWarehouseId || form.sourceWarehouseId) || !(item.destinationWarehouseId || form.destinationWarehouseId) || String(item.sourceWarehouseId || form.sourceWarehouseId)===String(item.destinationWarehouseId || form.destinationWarehouseId)))errors.push(prefix+'Choose different source and destination warehouses.');
    if(type==='PO' && (!item.supplierId || !item.warehouseId))errors.push(prefix+'Select a supplier and delivery warehouse.');
    if(type==='PRN') {
      if(!item.sourceGrnId || !item.warehouseId)errors.push(prefix+'Select an eligible original GRN and stocked warehouse.');
      if(!String(item.reason || '').trim() || item.reason.length>255)errors.push(prefix+'Enter a return reason of 1–255 characters.');
    }
    if(String(item.remarks ?? item.notes ?? '').length>MAX_NOTES)errors.push(prefix+'Notes are too long.');
  }
  return errors;
}

export function masterErrors(type,form,{draft=false}={}) {
 const errors={},product=type==='products',brand=type==='brands',warehouse=type==='warehouses';
 const code=product?'sku':'code',name=String(form.name || '').trim(),codeValue=String(form[code] || '').trim();
 const maxName=product?200:brand?150:100,maxCode=product || brand?50:20;
 if(!draft && !codeValue)errors[code]='Enter a code.';
 else if(codeValue.length>maxCode)errors[code]=`Code must be ${maxCode} characters or fewer.`;
 if(!name && !draft)errors.name='Enter a name.';
 else if(name && (name.length<2 || name.length>maxName))errors.name=`Name must contain 2–${maxName} characters.`;
 const remarksField=warehouse?'remarks':'description';
 if(String(form[remarksField] || '').length>MAX_NOTES)errors[remarksField]=`Remarks must be ${MAX_NOTES} characters or fewer.`;
 if(warehouse){
  if(String(form.address || '').length>MAX_NOTES)errors.address=`Address must be ${MAX_NOTES} characters or fewer.`;
  const phone=phoneError(form.contactNumber || form.phone,phoneCountry(form.contactNumber || form.phone));if(phone)errors.contactNumber=phone;
 }
 if(product){
  for(const key of ['brandId','categoryId','warehouseId'])if(!draft && !form[key])errors[key]='Select an option.';
  if(!draft || String(form.minStockLevel ?? '').trim()){const error=numberError(form.minStockLevel,'Minimum stock level',{decimals:0,max:2147483647});if(error)errors.minStockLevel=error;}
  if(!draft || String(form.markupPercent ?? '').trim()){const error=numberError(form.markupPercent,'MP%',{decimals:4,max:99999});if(error)errors.markupPercent=error;}
 }
 return errors;
}
