import {purchaseSellingPrice} from '../utils/purchaseSellingPrice';
import {numberError} from '../utils/purchasingValidation';
import {usePurchaseItemRemoval} from '../hooks/usePurchaseItemRemoval';
import PurchaseProductSearch from './PurchaseProductSearch';
import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import './PurchaseDocument.css';
import { readNumericInput } from '../utils/numericInput';

export default function PurchaseLines({ products, items, onChange, quantityField, withCost = false, showCostField = true, costReadOnly = false, initialQuantity = 1, documentFields, headerFields, actions, onProductSelect, validateItem, quantityLabel = "Quantity", quantityDetails, intakeLayout = "standard", intakeFields, inlineIntakeFields = false, extraColumns = [], buildItemData, onItemAdded, addDisabled = false, addHint, searchProducts = products, searchResultLimit = 50, resultQuantity, resultDetails, searchPriceField = 'costPrice', showSellingPrice = false, searchShowWarehouse = true, searchEmptyMessage = "No matching products found." }) {
  const [query,setQuery] = useState('');
  const [productId,setProductId] = useState('');
  const [selectedProduct,setSelectedProduct] = useState(null);
  const [quantity,setQuantity] = useState(initialQuantity);
  const [cost,setCost] = useState(0);
  const [editing,setEditing] = useState(null);
  const [showResults,setShowResults] = useState(false);
  const [touched,setTouched]=useState({});
  const quantityPrecision=quantityField==='quantity'?3:2;
  const quantityError=numberError(quantity,quantityLabel,{positive:true,decimals:quantityPrecision,max:quantityField==='quantity'?999999999999.999:Number.MAX_SAFE_INTEGER});
  const costError=withCost?numberError(cost,'Unit cost',{decimals:showCostField?2:6}):'';

  const {requestRemove,removalDialog}=usePurchaseItemRemoval({items,products,onRemove:index=>{onChange(items.filter((_,i)=>i!==index));setEditing(null);}});
  const product = selectedProduct || products.find(p => String(p.id) === String(productId));
  const filtered = searchProducts.filter(p => `${p.sku || ''} ${p.name || ''} ${p.barcode || ''}`.toLowerCase().includes((product ? '' : query).trim().toLowerCase())).slice(0,searchResultLimit);
  const selectProduct = selected => {
    setSelectedProduct(selected);
    onProductSelect?.(selected);
    setProductId(selected.id);setCost(selected.costPrice || 0);
    setQuery(`${selected.sku || ''} — ${selected.name}`);setShowResults(false);
  };
  const add = () => {
    if (addDisabled || !product || Boolean(quantityError || costError)) return;
    if (validateItem && !validateItem(product, Number(quantity), editing)) return;
    const item = { ...(editing === null ? {} : items[editing]), productId:product.id,
      ...buildItemData?.(product, editing), productName:product.name, sku:product.sku, warehouseId:product.defaultWarehouseId || product.warehouseId, [quantityField]:Number(quantity),
      ...(withCost ? { unitCost:Number(cost), totalCost:Number(quantity)*Number(cost) } : {}) };
    onChange(editing === null ? [...items,item] : items.map((old,index)=>index===editing ? item : old));
    setEditing(null);setTouched({});setQuantity(initialQuantity);setProductId('');setSelectedProduct(null);setQuery('');setCost(0);setShowResults(false);onItemAdded?.();
  };
  return <div className="purchase-lines">
    <div className="purchase-items">
      <h3>Items ({items.length})</h3>
      <div className="purchase-table-scroll">
        <table className="glass-table erp-table"><thead><tr><th className="erp-table-heading">Product code</th><th className="erp-table-heading">Product name</th>{extraColumns.map(column=><th className="erp-table-heading" key={column.label}>{column.label}</th>)}<th className="purchase-number erp-table-heading">Qty</th>{withCost && <th className="purchase-number erp-table-heading">{showSellingPrice ? 'Selling price' : 'Unit cost'}</th>}<th className="purchase-number erp-table-heading">Actions</th></tr></thead>
          <tbody>{items.map((item,index) => {
            const p=products.find(p=>String(p.id)===String(item.productId));
            return <tr key={index}><td className="purchase-product-code erp-table-cell">{p?.sku || item.sku || item.productSku || '—'}</td><td className="erp-table-cell">{p?.name || item.productName || item.productId}</td>
              {extraColumns.map(column=><td className="erp-table-cell" key={column.label}>{column.value(item)}</td>)}<td className="purchase-number erp-table-cell">{item[quantityField]}</td>{withCost && <td className="purchase-number erp-table-cell">LKR {(showSellingPrice ? purchaseSellingPrice(item,products) : Number(item.unitCost || 0)).toFixed(2)}</td>}
              <td className="purchase-number erp-table-cell"><div className="purchase-row-actions"><button type="button" aria-label={`Edit item ${index+1}`} onClick={()=>{setEditing(index);const selected=p ? {...p,defaultWarehouseId:item.sourceWarehouseId || item.warehouseId || p.defaultWarehouseId} : null;setSelectedProduct(selected);onProductSelect?.(selected,item,index);setProductId(item.productId);setQuantity(item[quantityField]);setCost(item.unitCost || 0);setQuery(`${p?.sku || item.sku || item.productSku || ''} — ${p?.name || item.productName || ''}`);setShowResults(false);}}><Pencil size={15}/></button>
                <button type="button" aria-label={`Remove item ${index+1}`} onClick={()=>requestRemove(index)}><Trash2 size={15}/></button></div></td></tr>;
          })}</tbody></table>
        {!items.length && <p className="purchase-empty">Select a product and add your first item.</p>}
      </div>
    </div>
    <div className={`purchase-entry${intakeLayout === 'gtn' ? ' gtn-intake' : ''}`}>
      {headerFields}
      <PurchaseProductSearch query={query} onQueryChange={value=>{setQuery(value);setProductId('');setSelectedProduct(null);}}
        results={filtered} onSelect={selectProduct} selected={Boolean(product)} editing={editing!==null}
        priceField={searchPriceField} showWarehouse={searchShowWarehouse}
        open={showResults} onOpenChange={setShowResults} resultQuantity={resultQuantity} resultDetails={resultDetails} emptyMessage={searchEmptyMessage}
        onClear={()=>{setQuery('');setProductId('');setSelectedProduct(null);onProductSelect?.(null);}}/>
      {intakeLayout === 'gtn' && <>
        {quantityDetails && <div className="purchase-stock-details gtn-available-quantity">{quantityDetails(product, editing)}</div>}
        {!inlineIntakeFields && intakeFields}
      </>}
      <div className="purchase-entry-fields">
        {inlineIntakeFields && intakeFields}
        {intakeLayout !== 'gtn' && quantityDetails && <div className="purchase-stock-details">{quantityDetails(product, editing)}</div>}
        <label>{quantityLabel} *<input className="erp-field" type="number" data-purchase-field="quantity" inputMode="decimal" min={quantityPrecision===3?"0.001":"0.01"} step={quantityPrecision===3?"0.001":"0.01"} value={quantity} aria-invalid={Boolean(touched.quantity && quantityError)} onBlur={()=>setTouched(previous=>({...previous,quantity:true}))} onFocus={event=>event.target.select()} onChange={e=>setQuantity(readNumericInput(e))}/>{touched.quantity && quantityError && <small className="purchase-field-error">{quantityError}</small>}</label>
        {withCost && showCostField && <label>Unit cost (LKR) *<input className="erp-field" type="number" data-purchase-field="cost" inputMode="decimal" min="0" step="0.01" aria-invalid={Boolean(touched.cost && costError)} onBlur={()=>setTouched(previous=>({...previous,cost:true}))} readOnly={costReadOnly} value={costReadOnly && !product ? '' : cost} onFocus={event=>event.target.select()} onChange={e=>setCost(readNumericInput(e))}/>{touched.cost && costError && <small className="purchase-field-error">{costError}</small>}</label>}
      </div>
      {intakeLayout === 'gtn' && documentFields}
      {addHint && <p className="purchase-add-hint">{addHint}</p>}
      <button type="button" className="btn btn-primary erp-button" disabled={addDisabled || !product || Boolean(quantityError || costError)} onClick={add}><Plus size={16}/>{editing === null ? 'Add item' : 'Update item'}</button>
      {intakeLayout !== 'gtn' && documentFields}
    </div>
    {actions && <div className="purchase-form-actions">{actions}</div>}
    {removalDialog}
  </div>;
}
