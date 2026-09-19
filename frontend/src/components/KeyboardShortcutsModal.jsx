import React from 'react';
import { X, Keyboard, Monitor, Navigation, FileText, CheckCircle, Search, Printer, Plus, Save } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global & Screen Controls',
      icon: Monitor,
      shortcuts: [
        { keys: ['F11', 'or', 'Alt', 'Enter'], description: 'Toggle Full Screen (Distraction-Free Mode)' },
        { keys: ['Ctrl', 'B'], description: 'Collapse / Expand Sidebar (Maximize Canvas)' },
        { keys: ['F1', 'or', '?'], description: 'Open Keyboard Shortcuts Guide' },
        { keys: ['Esc'], description: 'Close any Modal, Dialog, or Cancel active input' },
      ],
    },
    {
      title: 'Module Quick Navigation',
      icon: Navigation,
      shortcuts: [
        { keys: ['Alt', '1'], description: 'Executive Dashboard' },
        { keys: ['Alt', '2'], description: 'Inventory Operations Hub' },
        { keys: ['Alt', '3', 'or', 'F3'], description: 'Sales & POS Terminal' },
        { keys: ['Alt', '4'], description: 'Products (Business Directories)' },
        { keys: ['Alt', '5', 'or', 'F7'], description: 'Master Business Directories' },
        { keys: ['Alt', '6', 'or', 'F8'], description: 'Reports & Analytics' },
        { keys: ['Alt', '7'], description: 'System Administration' },
      ],
    },
    {
      title: 'Standard ERP Actions',
      icon: FileText,
      shortcuts: [
        { keys: ['F2'], description: 'Focus Search Box across any active module' },
        { keys: ['F4', 'or', 'Alt', 'N'], description: 'Add New Record (Product, Customer, Warehouse, etc.)' },
        { keys: ['F9', 'or', 'Ctrl', 'P'], description: 'Print active View / Invoice / Receipt' },
        { keys: ['F10', 'or', 'Ctrl', 'S'], description: 'Save & Submit active Form / Record' },
      ],
    },
    {
      title: 'POS Terminal Shortcuts',
      icon: CheckCircle,
      shortcuts: [
        { keys: ['F2'], description: 'Focus Product Search in POS' },
        { keys: ['F5', 'or', 'Ctrl', 'Space'], description: 'Proceed to Payment / Tender' },
        { keys: ['F12', 'or', 'Alt', 'H'], description: 'Hold Bill (Save Draft)' },
        { keys: ['F9'], description: 'Print Customer Receipt when sale completed' },
      ],
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-modal"
        style={{
          width: '100%',
          maxWidth: '720px',
          padding: '28px 32px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Keyboard size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>
                Standard ERP Keyboard Shortcuts
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Full-screen distraction-free workflow controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {shortcutGroups.map((group, idx) => {
            const GroupIcon = group.icon;
            return (
              <div key={idx} style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px 18px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#1e293b', fontWeight: 700, fontSize: '0.88rem' }}>
                  <GroupIcon size={16} color="#2563eb" />
                  {group.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.shortcuts.map((sc, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.86rem',
                        padding: '4px 0',
                      }}
                    >
                      <span style={{ color: '#475569' }}>{sc.description}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {sc.keys.map((k, kIdx) =>
                          k === 'or' ? (
                            <span key={kIdx} style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 2px' }}>
                              or
                            </span>
                          ) : (
                            <kbd key={kIdx} className="erp-kbd">
                              {k}
                            </kbd>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Tip: Press <kbd className="erp-kbd">Esc</kbd> anytime to dismiss modals without using mouse.
          </span>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
}
