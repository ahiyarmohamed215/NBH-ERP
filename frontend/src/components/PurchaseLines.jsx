import {usePurchaseItemRemoval} from '../hooks/usePurchaseItemRemoval';
import PurchaseProductSearch from './PurchaseProductSearch';
import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import './PurchaseDocument.css';
import { readNumericInput } from '../utils/numericInput';

export default function PurchaseLines({ products, items, onChange, quantityField, withCost = false, showCostField = true, costReadOnly = false, initialQuantity = 1, documentFields, headerFields, actions, onProductSelect, validateItem, quantityLabel = "Quantity", quantityDetails, intakeLayout = "standard", intakeFields, inlineIntakeFields = false, extraColumns = [], buildItemData, onItemAdded, addDisabled = false, addHint, searchProducts = products, searchResultLimit = 50, resultQuantity, resultDetails, searchEmptyMessage = "No matching products found." }) {
  const [query,setQuery] = useState('');
  const [productId,setProductId] = useState('');
  const [selectedProduct,setSelectedProduct] = useState(null);
  const [quantity,setQuantity] = useState(initialQuantity);
  const [cost,setCost] = useState(0);
  const [editing,setEditing] = useState(null);
  const [showResults,setShowResults] = useState(false);
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
    if (addDisabled || !product || quantity === '' || !Number.isFinite(Number(quantity)) || Number(quantity)<=0 || (withCost && (cost === '' || !Number.isFinite(Number(cost)) || Number(cost)<0))) return;
    if (validateItem && !validateItem(product, Number(quantity), editing)) return;
    const item = { ...(editing === null ? {} : items[editing]), productId:product.id,
      ...buildItemData?.(product, editing), productName:product.name, sku:product.sku, warehouseId:product.defaultWarehouseId || product.warehouseId, [quantityField]:Number(quantity),
      ...(withCost ? { unitCost:Number(cost), totalCost:Number(quantity)*Number(cost) } : {}) };
    onChange(editing === null ? [...items,item] : items.map((old,index)=>index===editing ? item : old));
    setEditing(null);setQuantity(initialQuantity);setProductId('');setSelectedProduct(null);setQuery('');setCost(0);setShowResults(false);onItemAdded?.();
  };
  return <div className="purchase-lines">
    <div className="purchase-items">
      <h3>Items ({items.length})</h3>
      <div className="purchase-table-scroll">
        <table className="glass-table"><thead><tr><th>Product code</th><th>Product name</th>{extraColumns.map(column=><th key={column.label}>{column.label}</th>)}<th className="purchase-number">Qty</th>{withCost && <th className="purchase-number">Unit cost</th>}<th className="purchase-number">Actions</th></tr></thead>
          <tbody>{items.map((item,index) => {
            const p=products.find(p=>String(p.id)===String(item.productId));
            return <tr key={index}><td className="purchase-product-code">{p?.sku || item.sku || item.productSku || '—'}</td><td>{p?.name || item.productName || item.productId}</td>
              {extraColumns.map(column=><td key={column.label}>{column.value(item)}</td>)}<td className="purchase-number">{item[quantityField]}</td>{withCost && <td className="purchase-number">LKR {Number(item.unitCost || 0).toFixed(2)}</td>}
              <td className="purchase-number"><div className="purchase-row-actions"><button type="button" aria-label={`Edit item ${index+1}`} onClick={()=>{setEditing(index);const selected=p ? {...p,defaultWarehouseId:item.sourceWarehouseId || item.warehouseId || p.defaultWarehouseId} : null;setSelectedProduct(selected);onProductSelect?.(selected,item,index);setProductId(item.productId);setQuantity(item[quantityField]);setCost(item.unitCost || 0);setQuery(`${p?.sku || item.sku || item.productSku || ''} — ${p?.name || item.productName || ''}`);setShowResults(false);}}><Pencil size={15}/></button>
                <button type="button" aria-label={`Remove item ${index+1}`} onClick={()=>requestRemove(index)}><Trash2 size={15}/></button></div></td></tr>;
          })}</tbody></table>
        {!items.length && <p className="purchase-empty">Select a product and add your first item.</p>}
      </div>
    </div>
    <div className={`purchase-entry${intakeLayout === 'gtn' ? ' gtn-intake' : ''}`}>
      {headerFields}
      <PurchaseProductSearch query={query} onQueryChange={value=>{setQuery(value);setProductId('');setSelectedProduct(null);}}
        results={filtered} onSelect={selectProduct} selected={Boolean(product)} editing={editing!==null}
        open={showResults} onOpenChange={setShowResults} resultQuantity={resultQuantity} resultDetails={resultDetails} emptyMessage={searchEmptyMessage}
        onClear={()=>{setQuery('');setProductId('');setSelectedProduct(null);onProductSelect?.(null);}}/>
      {intakeLayout === 'gtn' && <>
        {quantityDetails && <div className="purchase-stock-details gtn-available-quantity">{quantityDetails(product, editing)}</div>}
        {!inlineIntakeFields && intakeFields}
      </>}
      <div className="purchase-entry-fields">
        {inlineIntakeFields && intakeFields}
        {intakeLayout !== 'gtn' && quantityDetails && <div className="purchase-stock-details">{quantityDetails(product, editing)}</div>}
        <label>{quantityLabel} *<input type="number" inputMode="numeric" min="1" step="1" value={quantity} onFocus={event=>event.target.select()} onChange={e=>setQuantity(readNumericInput(e))}/></label>
        {withCost && showCostField && <label>Unit cost (LKR) *<input type="number" inputMode="decimal" min="0" step="0.01" readOnly={costReadOnly} value={costReadOnly && !product ? '' : cost} onFocus={event=>event.target.select()} onChange={e=>setCost(readNumericInput(e))}/></label>}
      </div>
      {intakeLayout === 'gtn' && documentFields}
      {addHint && <p className="purchase-add-hint">{addHint}</p>}
      <button type="button" className="btn btn-primary" disabled={addDisabled || !product || quantity === '' || !Number.isFinite(Number(quantity)) || Number(quantity)<=0 || (withCost && (cost === '' || !Number.isFinite(Number(cost)) || Number(cost)<0))} onClick={add}><Plus size={16}/>{editing === null ? 'Add item' : 'Update item'}</button>
      {intakeLayout !== 'gtn' && documentFields}
    </div>
    {actions && <div className="purchase-form-actions">{actions}</div>}
    {removalDialog}
  </div>;
}
