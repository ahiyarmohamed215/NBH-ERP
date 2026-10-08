import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';

const WorkspaceActive = createContext(true);
export const useWorkspaceActive = () => useContext(WorkspaceActive);

function Workspace({ active, id, children }) {
  const element = useRef(null);
  const positions = useRef(new Map());
  useLayoutEffect(() => {
    if (!active) return;
    for (const [node, [top, left]] of positions.current) {
      if (node.isConnected) { node.scrollTop = top; node.scrollLeft = left; }
      else positions.current.delete(node);
    }
  }, [active]);
  return <WorkspaceActive.Provider value={active}>
    <section ref={element} data-workspace={id} data-active={active} hidden={!active} inert={!active}
      onScrollCapture={event => {
        if (active) positions.current.set(event.target, [event.target.scrollTop, event.target.scrollLeft]);
      }}
      style={{ display:active ? 'flex' : 'none', flexDirection:'column', flex:1, minHeight:0, minWidth:0, overflow:'auto' }}>
      {children}
    </section>
  </WorkspaceActive.Provider>;
}

// Only visited, permitted workspaces are mounted. A session-key change discards all drafts.
export default function RetainedWorkspaces({ current, allowed, render }) {
  const [visited, setVisited] = useState([current]);
  const visibleIds = [...new Set([...visited, current])].filter(id => allowed.includes(id));
  useLayoutEffect(() => {
    setVisited(previous => {
      const next = [...new Set([...previous, current])].filter(id => allowed.includes(id));
      return next.length === previous.length && next.every((id,index) => id === previous[index]) ? previous : next;
    });
  }, [current, allowed]);
  return visibleIds.map(id => <Workspace key={id} id={id} active={current === id}>{render(id)}</Workspace>);
}
