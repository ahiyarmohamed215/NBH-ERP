import {useEffect,useState} from 'react';
import {resolveModuleTab,permissionNames,roleNames} from '../utils/moduleAccess';

/** Resolve links and role changes before a module renders or fetches a restricted tab. */
export default function useModuleTab(module,requested,fallback,user){
  const [selected,setSelected]=useState(()=>resolveModuleTab(user,module,requested,fallback));
  const current=resolveModuleTab(user,module,selected ?? requested,fallback);
  const accessKey=JSON.stringify([user?.username,roleNames(user),permissionNames(user)]);
  useEffect(()=>{setSelected(resolveModuleTab(user,module,requested,fallback));},[module,requested,fallback]);
  useEffect(()=>{setSelected(previous=>resolveModuleTab(user,module,previous ?? requested,fallback));},[module,fallback,accessKey]);
  const select=next=>setSelected(previous=>resolveModuleTab(user,module,typeof next==='function'?next(previous):next,fallback));
  return [current,select];
}
