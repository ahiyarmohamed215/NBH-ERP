import React, {createContext,useContext} from 'react';
import {useAuth} from '../context/AuthContext';
import {canAccessTab} from '../utils/moduleAccess';
const ModuleContext=createContext(null);

/** Shared module navigation; appearance and hover states live in ErpDesignSystem.css. */
export default function ErpTabs({children,module,className='',...props}) {
  return <ModuleContext.Provider value={module || null}><div {...props} className={`erp-tabs ${className}`.trim()}>{children}</div></ModuleContext.Provider>;
}

export function ErpTab({children,tabId,active,'data-active':dataActive,className='',...props}) {
  const module=useContext(ModuleContext);
  const auth=useAuth();
  if(module && tabId && !canAccessTab(auth?.user,module,tabId))return null;
  const selected=active ?? dataActive ?? false;
  return <button {...props} type={props.type || 'button'} className={`erp-tab ${className}`.trim()}
    data-active={selected} aria-pressed={selected}>{children}</button>;
}
