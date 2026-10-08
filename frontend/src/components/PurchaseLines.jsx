import React, { useState } from 'react';
import { Plus, Pencil, X } from 'lucide-react';
import './PurchaseDocument.css';

export default function PurchaseLines({ products, items, onChange, quantityField, withCost = false }) {
  const [query,setQuery] = useState('');
  const [productId,setProductId] = useState('');
  const [quantity,setQuantity] = useState(1);
  const [cost,setCost] = useState(0);
  const [editing,setEditing] = useState(null);
  const product = products.find(p => String(p.id) === String(productId));
  const filtered = products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(query.toLowerCase()));
  const selectProduct = value => { setProductId(value);setCost(products.find(p=>String(p.id)===String(value))?.costPrice || 0); };
  const add = () => {
    if (!product || Number(quantity)<=0 || (withCost && Number(cost)<0)) return;
    const item = { ...(editing === null ? {} : items[editing]), productId:product.id,
      productName:product.name, sku:product.sku, [quantityField]:Number(quantity),
      ...(withCost ? { unitCost:Number(cost), totalCost:Number(quantity)*Number(cost) } : {}) };
    onChange(editing === null ? [...items,item] : items.map((old,index)=>index===editing ? item : old));
    setEditing(null);setQuantity(1);setProductId('');setQuery('');setCost(0);
  };
  return <div className="purchase-lines">
    <div className="purchase-items">
      <h3>Items ({items.length})</h3>
      <div className="purchase-table-scroll">
        <table className="glass-table"><thead><tr><th>Product</th><th>Quantity</th>{withCost && <><th>Unit cost</th><th>Line total</th></>}<th>Actions</th></tr></thead>
          <tbody>{items.map((item,index) => {
            const p=products.find(p=>String(p.id)===String(item.productId));
            return <tr key={index}><td>{p?.name || item.productName || item.productId}<small>{p?.sku || item.sku}</small></td>
              <td>{item[quantityField]}</td>{withCost && <><td>${Number(item.unitCost || 0).toFixed(2)}</td><td>${(Number(item[quantityField])*Number(item.unitCost || 0)).toFixed(2)}</td></>}
              <td><button type="button" aria-label={`Edit item ${index+1}`} onClick={()=>{setEditing(index);setProductId(item.productId);setQuantity(item[quantityField]);setCost(item.unitCost || 0);setQuery('');}}><Pencil size={15}/></button>
                <button type="button" aria-label={`Remove item ${index+1}`} onClick={()=>{onChange(items.filter((_,i)=>i!==index));setEditing(null);}}><X size={15}/></button></td></tr>;
          })}</tbody></table>
        {!items.length && <p className="purchase-empty">Select a product and add your first item.</p>}
      </div>
    </div>
    <div className="purchase-entry">
      <h3>{editing === null ? 'Product entry' : 'Edit item'}</h3>
      <label>Search products<input placeholder="SKU or product name" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Product *<select value={productId} onChange={e=>selectProduct(e.target.value)}><option value="">Select a product</option>
        {filtered.map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
      </select></label>
      <div className="purchase-entry-fields">
        <label>Quantity *<input type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
        {withCost && <label>Unit cost ($) *<input type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></label>}
        {withCost && <label>Line total<output>${(Number(quantity)*Number(cost)).toFixed(2)}</output></label>}
      </div>
      <button type="button" className="btn btn-primary" disabled={!product || Number(quantity)<=0 || (withCost && Number(cost)<0)} onClick={add}><Plus size={16}/>{editing === null ? 'Add item' : 'Update item'}</button>
    </div>
  </div>;
}
