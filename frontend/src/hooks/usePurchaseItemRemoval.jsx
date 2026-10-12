import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Trash2,X} from 'lucide-react';
import '../components/PurchasingAppearance.css';
import '../components/PurchaseItemRemoval.css';

function RemovalDialog({item,product,onClose,onConfirm}) {
  const dialog=useRef(null),cancel=useRef(null),titleId=useId(),descriptionId=useId();
  useEffect(()=>{
    const previous=document.activeElement;
    cancel.current?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='Tab') {
        const buttons=[...dialog.current.querySelectorAll('button:not(:disabled)')];
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return ()=>{document.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus();};
  },[]);
  const name=product?.name || item.productName || item.tradeName || 'Selected product';
  const code=product?.sku || item.sku || item.productSku || item.productCode;
  return createPortal(<div className="modal-backdrop purchasing-no-shadows purchase-remove-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={dialog} className="purchase-remove-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header><span className="purchase-remove-symbol"><Trash2 size={18}/></span><h2 id={titleId}>Remove product?</h2><button type="button" className="purchase-remove-close" aria-label="Close removal confirmation" onClick={onClose}><X size={18}/></button></header>
      <p id={descriptionId}>Remove this added product from the document?</p>
      <div className="purchase-remove-product">{code && <small>{code}</small>}<strong>{name}</strong></div>
      <footer><button ref={cancel} type="button" onClick={onClose}>Cancel</button><button type="button" className="purchase-remove-confirm" onClick={onConfirm}>Remove product</button></footer>
    </div>
  </div>,document.body);
}

export function usePurchaseItemRemoval({items,products,onRemove}) {
  const [pending,setPending]=useState(null);
  const close=()=>setPending(null);
  const requestRemove=index=>{if(items[index])setPending(items[index]);};
  const confirm=()=>{
    const index=items.indexOf(pending);
    if(index!==-1)onRemove(index);
    close();
  };
  return {requestRemove,removalDialog:pending && <RemovalDialog item={pending} product={products.find(product=>String(product.id)===String(pending.productId))} onClose={close} onConfirm={confirm}/>};
}
