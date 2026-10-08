import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState, useEffect } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('sidebar navigation retains drafts and scroll, hides inactive pages, and clears sessions', async () => {
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const server = await createServer({ server:{middlewareMode:true,hmr:false}, appType:'custom', optimizeDeps:{noDiscovery:true,include:[]} });
  const host = document.createElement('div');document.body.append(host);
  const root = createRoot(host);
  try {
    const { default: Workspaces, useWorkspaceActive } = await server.ssrLoadModule('/src/components/RetainedWorkspaces.jsx');
    const mounts = {};
    function Draft({ id }) {
      const [value,setValue] = useState('');
      const active = useWorkspaceActive();
      useEffect(() => { mounts[id] = (mounts[id] || 0) + 1; }, []);
      return React.createElement('div', null,
        React.createElement('input', { 'aria-label':id, value, onInput:e=>setValue(e.target.value) }),
        React.createElement('div', { 'data-scroll':id }, value),
        React.createElement('span', null, active ? 'active' : 'inactive'));
    }
    const render = async (current, allowed=['purchasing','inventory'], session='user-1') => {
      await act(async () => root.render(React.createElement(Workspaces, { key:session, current, allowed,
        render:id=>React.createElement(Draft,{id}) })));
    };
    await render('purchasing');
    const input = host.querySelector('input');
    await act(async () => { input.value='Unsaved GRN notes';input.dispatchEvent(new window.Event('input',{bubbles:true})); });
    const scroll = host.querySelector('[data-scroll]');scroll.scrollTop=150;
    scroll.dispatchEvent(new window.Event('scroll'));
    await render('inventory');
    assert.ok(host.querySelector('[data-workspace="purchasing"]').hidden);
    assert.ok(host.querySelector('[data-workspace="purchasing"]').hasAttribute('inert'));
    scroll.scrollTop=0; // Browsers can reset scroll offsets on hidden content.
    await render('purchasing');
    assert.equal(host.querySelector('input').value,'Unsaved GRN notes');
    assert.equal(scroll.scrollTop,150);
    assert.equal(mounts.purchasing,1);
    await render('inventory',['inventory']);
    assert.equal(host.querySelector('[data-workspace="purchasing"]'),null);
    await render('purchasing');
    assert.equal(host.querySelector('[aria-label="purchasing"]').value,'');
    await render('purchasing',undefined,'user-2');
    assert.equal(host.querySelector('[aria-label="purchasing"]').value,'');
    assert.equal(host.querySelector('[data-workspace="inventory"]'),null);
  } finally {
    await act(async () => root.unmount());
    await server.close();await window.happyDOM.close();
    delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
