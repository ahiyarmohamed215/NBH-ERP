import {printA4Report} from './printReport';
import {posRemarks,isCancelledBill} from './billRemarks';
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function printHeldBill(bill){
  const money=value=>Number(value || 0).toFixed(2);
  printA4Report({title:`Held Bill ${escape(bill.heldNumber)}`,
    metaItems:[{label:'Customer',value:escape(bill.customerName)},{label:'Bill date',value:escape((bill.createdAt || bill.invoiceDate)?.slice(0,10))},
      {label:'Staff',value:escape([bill.createdByName || bill.createdBy,bill.createdByEmployeeCode].filter(Boolean).join(' · '))},
      {label:'Status',value:isCancelledBill(bill)?'Cancelled':'Billed'},{label:'Remarks',value:escape(posRemarks(bill)) || '—'},
      ...(isCancelledBill(bill)?[{label:'Cancellation reason',value:escape(bill.cancellationReason) || '—'}]:[])],
    columns:[{header:'Product',accessor:'product'},{header:'Unit price',accessor:'price',align:'right'},{header:'Selling qty',accessor:'quantity',align:'right'},
      {header:'Sub line total',accessor:'subtotal',align:'right'},{header:'Discount %',accessor:'rate',align:'right'},{header:'Discount Rs.',accessor:'discount',align:'right'},{header:'Line total',accessor:'total',align:'right'}],
    data:(bill.items || []).map(line=>{
      const gross=Math.round(Number(line.quantity || 0)*Number(line.unitPrice || 0)*100)/100;
      const discount=line.discountAmount!=null?Number(line.discountAmount):Math.round(gross*Number(line.discountRate || 0))/100;
      return {product:escape(line.productName)+'<br>'+escape(line.productSku),price:money(line.unitPrice),quantity:Number(line.quantity || 0),subtotal:money(gross),
        rate:money(Number(line.discountRate || 0) || (gross?discount/gross*100:0))+'%',discount:money(discount),total:money(line.totalPrice ?? gross-discount)};
    }),
    summaryItems:[{label:'Bill discount (LKR)',value:money(bill.discountAmount)},{label:'Tax (LKR)',value:money(bill.taxAmount)},{label:'Bill total (LKR)',value:money(bill.netTotal)}],
  });
}
