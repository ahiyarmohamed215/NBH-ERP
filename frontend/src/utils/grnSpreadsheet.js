import {numberError} from './purchasingValidation.js';

export const GRN_SHEET_HEADERS=['Supplier','Product name','Product code','Received qty','Unit cost','MP%','Selling price','Remarks'];
const text=value=>String(value ?? '').trim();
const key=value=>text(value).toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseCsvRows(content) {
  const rows=[];let row=[],value='',quoted=false;
  for(let index=0;index<content.length;index++) {
    const char=content[index];
    if(char==='"'){if(quoted && content[index+1]==='"'){value+='"';index++;}else quoted=!quoted;}
    else if(char===',' && !quoted){row.push(value);value='';}
    else if((char==='\n' || char==='\r') && !quoted){if(char==='\r' && content[index+1]==='\n')index++;row.push(value);rows.push(row);row=[];value='';}
    else value+=char;
  }
  if(quoted)throw new Error('A quoted CSV field is not closed.');
  if(value || row.length){row.push(value);rows.push(row);}
  return rows;
}
export function importGrnRows(rows,products,suppliers) {
  const nonempty=rows.filter(row=>row.some(value=>text(value)));
  if(nonempty.length<2)throw new Error('The spreadsheet has no product rows.');
  const header=nonempty[0].map(key),columns=GRN_SHEET_HEADERS.map(name=>header.indexOf(key(name)));
  const missing=GRN_SHEET_HEADERS.filter((_,index)=>columns[index]<0);
  if(missing.length)throw new Error(`Missing columns: ${missing.join(', ')}.`);
  if(new Set(header).size!==header.length)throw new Error('Remove duplicate column headers.');
  let supplierId=null,remarks='';const items=[],seen=new Set();
  const errors=[];
  for(const [index,row] of nonempty.slice(1).entries()) {
    const [supplier,name,code,qty,cost,mp,selling,note]=columns.map(column=>text(row[column]));
    // Unfilled catalogue rows in the template are not receipts.
    if(!qty)continue;
    try {
      const matches=products.filter(product=>code ? text(product.sku).toLowerCase()===code.toLowerCase() : text(product.name).toLowerCase()===name.toLowerCase());
      if(matches.length!==1)throw new Error(`Product ${code || name || '(empty)'} ${matches.length?'is ambiguous':'was not found'}.`);
      const product=matches[0];
      if(name && name.toLowerCase()!==text(product.name).toLowerCase())throw new Error(`Product name does not match code ${code}.`);
      if(seen.has(product.id))throw new Error(`Product ${code || name} appears more than once; combine its quantity into one row.`);
      const suppliersMatched=suppliers.filter(item=>[item.name,item.code,item.supplierCode].some(value=>text(value).toLowerCase()===supplier.toLowerCase()));
      if(!supplier || suppliersMatched.length!==1)throw new Error('Enter a matching active supplier name or supplier code.');
      if(supplierId && supplierId!==suppliersMatched[0].id)throw new Error('All rows in one GRN must use the same supplier.');
      if(note.length>5000)throw new Error('Remarks must be 5000 characters or fewer.');
      if(note && remarks && note!==remarks)throw new Error('Remarks are common to the GRN; use the same remarks on each row.');
      const quantityError=numberError(qty,'Received quantity',{positive:true});if(quantityError)throw new Error(quantityError);
      const unitCost=cost===''?Number(product.costPrice || 0):Number(cost);
      const costError=numberError(cost===''?unitCost:cost,'Unit cost');if(costError)throw new Error(costError);
      let markupPercent=mp===''?Number(product.brandMarkupPercent || 0):Number(mp);
      if(!Number.isFinite(markupPercent) || markupPercent < -100 || markupPercent > 99999 || (mp && !/^-?\d+(\.\d{1,2})?$/.test(mp)))throw new Error('Enter a valid MP% with up to 2 decimal places, between -100 and 99999.');
      const salePrice=selling===''?Number((unitCost*(1+markupPercent/100)).toFixed(2)):Number(selling);
      const saleError=numberError(selling===''?salePrice:selling,'Selling price');if(saleError)throw new Error(saleError);
      if(selling!=='' && mp!=='' && Math.abs(salePrice-Number((unitCost*(1+markupPercent/100)).toFixed(2)))>0.005)throw new Error('Selling price does not match unit cost + MP%. Correct MP% or leave it empty for manual pricing.');
      if(selling!=='')markupPercent=unitCost?Number(((salePrice/unitCost-1)*100).toFixed(2)):0;
      if(markupPercent>99999)throw new Error('Selling price produces an MP% greater than 99999.');
      supplierId=suppliersMatched[0].id;if(note)remarks=note;
      seen.add(product.id);
      const quantityReceived=Number(qty),amount=quantityReceived*unitCost;
      items.push({productId:product.id,productCode:product.sku,tradeName:product.name,unitOfMeasure:product.unitOfMeasure || 'PCS',quantityReceived,unitCost,salePrice,markupPercent,brandMarkupPercent:markupPercent,useBrandMarkup:selling==='' && mp==='',freeQuantity:0,packQty:1,packSize:1,purchaseValue:amount,amount,discountPercent:0,discountAmount:0,freeCostPrice:unitCost,gpPercent:salePrice?(salePrice-unitCost)/salePrice*100:0,notes:''});
    } catch(error){errors.push(`Row ${index+2}: ${error.message}`);}
  }
  if(errors.length)throw new Error(errors.slice(0,5).join('\n')+(errors.length>5?`\nAnd ${errors.length-5} more row errors.`:''));
  if(!items.length)throw new Error('Enter received quantities for at least one product.');
  return {supplierId,remarks,items};
}
async function workbook(){const module=await import('exceljs');return new (module.default || module).Workbook();}
export async function readGrnWorkbook(buffer) {
  const book=await workbook();await book.xlsx.load(buffer);
  const sheet=book.worksheets[0];if(!sheet)throw new Error('The workbook has no worksheet.');
  const rows=[];sheet.eachRow(row=>rows.push(Array.from({length:Math.max(8,row.cellCount)},(_,index)=>row.getCell(index+1).text)));
  return rows;
}
export async function createGrnTemplate(products,{supplier='',remarks=''}={}) {
  const book=await workbook(),sheet=book.addWorksheet('GRN intake');
  sheet.addRow(GRN_SHEET_HEADERS);sheet.views=[{state:'frozen',ySplit:1}];
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).height=24;
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2563EB'}};
  [30,32,22,18,18,12,18,42].forEach((width,index)=>sheet.getColumn(index+1).width=width);
  for(const product of products)sheet.addRow([supplier,product.name,product.sku,null,Number(product.costPrice || 0),Number(product.brandMarkupPercent || 0),null,remarks]);
  sheet.autoFilter='A1:H1';sheet.getColumn(3).numFmt='@';
  for(const column of [4,5,6,7])sheet.getColumn(column).numFmt='0.00';
  return book.xlsx.writeBuffer();
}
