import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Trash2,X} from 'lucide-react';
import '../components/PurchasingAppearance.css';
import '../components/PurchaseItemRemoval.css';

export function RemovalDialog({item,product,onClose,onConfirm,busy=false,title='Remove product?',description='Remove this added product from the document?',confirmLabel='Remove product',icon:Icon=Trash2}) {
  const dialog=useRef(null),cancel=useRef(null),titleId=useId(),descriptionId=useId();
  useEffect(()=>{
    const previous=document.activeElement;
    cancel.current?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();if(!busy)onClose();}
      if(event.key==='Tab') {
        const buttons=[...dialog.current.querySelectorAll('button:not(:disabled)')];
        if(!buttons.length){event.preventDefault();return;}
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return ()=>{document.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus();};
  },[busy]);
  const name=product?.name || item.productName || item.name || item.tradeName || 'Selected product';
  const code=product?.sku || item.sku || item.productSku || item.productCode;
  return createPortal(<div className="modal-backdrop purchasing-no-shadows purchase-remove-backdrop" onMouseDown={event=>{if(!busy && event.target===event.currentTarget)onClose();}}>
    <div ref={dialog} className="purchase-remove-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header><span className="purchase-remove-symbol"><Icon size={18}/></span><h2 id={titleId}>{title}</h2><button type="button" className="purchase-remove-close" aria-label="Close removal confirmation" disabled={busy} onClick={onClose}><X size={18}/></button></header>
      <p id={descriptionId}>{description}</p>
      <div className="purchase-remove-product">{code && <small>{code}</small>}<strong>{name}</strong></div>
      <footer><button ref={cancel} type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="purchase-remove-confirm" disabled={busy} onClick={onConfirm}>{busy?'Clearing…':confirmLabel}</button></footer>
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
  return {requestRemove,isRemovalOpen:pending!==null,removalDialog:pending && <RemovalDialog item={pending} product={products.find(product=>String(product.id)===String(pending.productId))} onClose={close} onConfirm={confirm}/>};
}
