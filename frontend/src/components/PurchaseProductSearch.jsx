import React,{useId,useState} from 'react';
import {Search,X,CheckCircle} from 'lucide-react';
import './PurchaseProductSearch.css';

export default function PurchaseProductSearch({query,onQueryChange,results,onSelect,onClear,selected,editing=false,open,onOpenChange,resultQuantity,resultDetails,showWarehouse=true,priceField='costPrice',emptyMessage='No matching products found.'}) {
  const id=useId(),[active,setActive]=useState(0);
  const choose=product=>{onSelect(product);onOpenChange(false);};
  return <>
    <div className="purchase-search-heading"><h3><Search size={15}/>{editing ? 'Edit item' : 'Product search & intake'}</h3>{selected && <span><CheckCircle size={13}/> Product selected</span>}</div>
    <div className="purchase-product-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))onOpenChange(false);}}>
      <div className="purchase-search-input"><Search size={16}/><input type="text" aria-label="Search products" placeholder="Search product by SKU, name or barcode..."
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id} aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
        value={query} onFocus={()=>{onOpenChange(true);setActive(0);}} onChange={event=>{onQueryChange(event.target.value);onOpenChange(true);setActive(0);}}
        onKeyDown={event=>{
          if(event.key==='Escape'){event.preventDefault();onOpenChange(false);}
          else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();onOpenChange(true);setActive(index=>Math.max(0,Math.min(results.length-1,index+(event.key==='ArrowDown'?1:-1))));}
          else if(event.key==='Enter' && open){event.preventDefault();if(results[active])choose(results[active]);}
        }}/>{query && <button type="button" aria-label="Clear product search" onClick={()=>{onClear();onOpenChange(false);}}><X size={15}/></button>}</div>
      {open && <div className="purchase-product-results" id={id} role="listbox" aria-label="Product search results">
        {results.map((product,index)=><button type="button" key={product.searchKey || product.id} id={`${id}-${index}`} role="option" aria-selected={index===active}
          onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(product)}>
          <span className="purchase-result-product"><span className="purchase-result-title"><span className="purchase-result-code">{product.sku || '—'}</span><span className="purchase-result-name">{product.name}</span></span>
            <span className="purchase-result-details"><span>{priceField==='sellingPrice'?'Selling price':'Unit cost'}: <b>LKR {Number(product[priceField] || 0).toFixed(2)}</b></span>{showWarehouse && product.warehouseName && <span>Warehouse: <b>{product.warehouseName}</b></span>}{resultDetails && <span>{resultDetails(product)}</span>}</span>
          </span>
          {resultQuantity && <span className="purchase-result-stock">Available: <b>{resultQuantity(product)}</b></span>}
        </button>)}
        {!results.length && <p>{emptyMessage}</p>}
      </div>}
    </div>
  </>;
}
