import React,{useEffect} from 'react';
import {Boxes,Banknote} from 'lucide-react';
import PurchaseInspectionModal from './PurchaseInspectionModal';
import './StockDetailsModal.css';

const quantity=value=>Number(value ?? 0).toLocaleString();
const money=value=>`LKR ${Number(value ?? 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function StockDetailsModal({item,canSeeCost,onClose}) {
  useEffect(()=>{
    const previous=document.activeElement;
    const dialog=document.querySelector('.inventory-inspection');
    dialog?.querySelector('.purchase-inspection-close')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key!=='Tab' || !dialog)return;
      const controls=[...dialog.querySelectorAll('button,input')].filter(control=>!control.disabled);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',keydown);
    return ()=>{document.removeEventListener('keydown',keydown);previous?.focus?.();};
  },[onClose]);
  const columns=[
    {label:'Warehouse',value:row=>row.warehouseName},
    {label:'On-hand quantity',numeric:true,value:row=>quantity(row.quantity)},
    {label:'Available quantity',numeric:true,value:row=>quantity(row.availableQuantity)},
    {label:'Reserved quantity',numeric:true,value:row=>quantity(row.reservedQuantity)},
    {label:'Minimum stock level',numeric:true,value:row=>quantity(row.minStockLevel)},
    {label:'Selling price',numeric:true,value:row=>money(row.sellingPrice)},
    ...(canSeeCost ? [
      {label:'Unit cost',numeric:true,value:row=>money(row.costPrice)},
      {label:'Stock value at cost',numeric:true,value:row=>money(row.totalCostValue)}
    ] : [])
  ];
  return <PurchaseInspectionModal type="Inventory" number={item.productName} tableToolbar headerPrint
    status={item.isOutOfStock?'OUT_OF_STOCK':item.isLowStock?'LOW_STOCK':'IN_STOCK'}
    rows={[item]} columns={columns} onClose={onClose}
    footer={<footer className="inventory-stock-summary-footer"><button type="button" className="btn btn-glass erp-button" onClick={onClose}>Close</button></footer>}
    content={<div className="inventory-stock-summary">
      <section aria-label="Stock quantities"><div className="inventory-stock-section-title"><Boxes size={17}/><div><h3>Stock quantities</h3><p className="inventory-stock-summary-caption">Physical stock and availability in this warehouse</p></div></div>
        <dl className="inventory-stock-summary-quantities">
          {columns.slice(1,5).map((column,index)=><div key={column.label}><dt>{column.label}</dt><dd>{column.value(item)} <small>{item.unitOfMeasure}</small></dd><p className="inventory-stock-metric-note">{['Total stock in warehouse','Ready to sell or transfer','Already reserved','Low-stock threshold'][index]}</p></div>)}
        </dl>
      </section>
      <section aria-label="Stock pricing"><div className="inventory-stock-section-title"><Banknote size={17}/><div><h3>Pricing &amp; stock value</h3><p className="inventory-stock-summary-caption">{canSeeCost ? 'Selling price, purchase cost and current stock value' : 'Current selling price for this product'}</p></div></div>
        <dl className="inventory-stock-summary-prices">
          {columns.slice(5).map(column=><div key={column.label}><dt>{column.label}</dt><dd>{column.value(item)}</dd></div>)}
        </dl>
      </section>
    </div>}
    details={[
      {label:'Product code',value:item.sku},
      {label:'Warehouse',value:item.warehouseName},
      {label:'Warehouse code',value:item.warehouseCode},
      {label:'Brand',value:item.brandName},
      {label:'Category',value:item.categoryName},
      {label:'Unit',value:item.unitOfMeasure}
    ]}/>
}
