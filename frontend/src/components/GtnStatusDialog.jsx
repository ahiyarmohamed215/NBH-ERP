import React from 'react';
import PurchasingStatusDialog from './PurchasingStatusDialog';

export default function GtnStatusDialog({ document, target, reason, onReasonChange, confirmed, onConfirmChange, busy, onClose, onSave }) {
  const reversesStock=document.status==='TRANSFERRED' && target!=='TRANSFERRED';
  const description=reversesStock ? 'Transferred quantities will return to the source warehouse. Enough available stock must remain at the destination.' : target==='TRANSFERRED' ? 'Inventory will move from the source to the destination after confirmation.' : 'This change does not move inventory.';
  return <PurchasingStatusDialog pending={{type:'GTN',number:document.gtnNumber,current:document.status,target,description}} reason={reason} onReasonChange={onReasonChange} busy={busy} onClose={onClose} onConfirm={onSave}
    confirmation={target==='TRANSFERRED' ? {checked:confirmed,onChange:onConfirmChange,label:'Signed copy returned; all products received'} : undefined}/>;
}
