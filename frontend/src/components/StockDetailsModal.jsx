import React,{useEffect,useRef} from 'react';
import {Boxes,X} from 'lucide-react';
import StatusBadge from './StatusBadge';
import './PurchaseInspectionModal.css';
import './StockDetailsModal.css';

const quantity=value=>Number(value ?? 0).toLocaleString();
const money=value=>`LKR ${Number(value ?? 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function StockDetailsModal({item,canSeeCost,onClose}) {
  const close=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    close.current?.focus();
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('keydown',escape);previous?.focus?.();};
  },[onClose]);
  const details=[['Product code',item.sku],['Warehouse',item.warehouseName],
    ...(item.warehouseCode ? [['Warehouse code',item.warehouseCode]] : []),
    ['Brand',item.brandName],['Category',item.categoryName],['Unit',item.unitOfMeasure]];
  const metrics=[['On-hand quantity',quantity(item.quantity)],['Available quantity',quantity(item.availableQuantity)],
    ['Reserved quantity',quantity(item.reservedQuantity)],['Minimum stock level',quantity(item.minStockLevel)]];
  const pricing=[['Selling price',money(item.sellingPrice)],
    ...(canSeeCost ? [['Unit cost',money(item.costPrice)],['Stock value at cost',money(item.totalCostValue)]] : [])];
  return <div className="modal-backdrop" style={{padding:12,zIndex:1100}}>
    <section className="glass-modal purchase-inspection inventory-stock-inspection" role="dialog" aria-modal="true" aria-labelledby="inventory-stock-title" onKeyDown={event=>{
      if(event.key!=='Tab')return;
      const buttons=event.currentTarget.querySelectorAll('button');
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }}>
      <header className="purchase-inspection-header">
        <div className="purchase-inspection-header-main">
          <div className="purchase-inspection-title"><div className="grn-inspection-symbol"><Boxes size={22}/></div><div>
            <span className="purchase-inspection-caption">Inventory stock</span>
            <div className="purchase-inspection-number-row"><h2 id="inventory-stock-title">{item.productName}</h2>
              <StatusBadge status={item.isOutOfStock?'OUT_OF_STOCK':item.isLowStock?'LOW_STOCK':'IN_STOCK'}/></div>
          </div></div>
          <button ref={close} type="button" className="purchase-inspection-close" aria-label="Close stock details" onClick={onClose}><X size={18}/></button>
        </div>
      </header>
      <div className="inventory-stock-body">
        <dl className="inventory-stock-details" aria-label="Product and warehouse details">
          {details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
        </dl>
        <section aria-label="Stock quantities"><h3>Stock quantities</h3><dl className="inventory-stock-metrics">
          {metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value} <small>{item.unitOfMeasure}</small></dd></div>)}
        </dl></section>
        <section aria-label="Stock pricing"><h3>Pricing</h3><dl className="inventory-stock-pricing">
          {pricing.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl></section>
      </div>
      <footer className="inventory-stock-footer"><button type="button" className="btn btn-glass" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
