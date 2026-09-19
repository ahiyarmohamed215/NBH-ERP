import { useEffect } from 'react';

export default function useErpShortcuts({
  toggleFullscreen,
  toggleSidebar,
  openShortcutsModal,
  closeModals,
  navigateTo,
  isModalOpen,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      // F11 or Alt+Enter: Toggle True Full Screen
      if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // F1: Open Shortcuts Guide
      if (e.key === 'F1') {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      // '?' (Shift + /) when not in input: Open Shortcuts Guide
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      // Esc: Close open modals / cancel / blur
      if (e.key === 'Escape') {
        if (isModalOpen) {
          e.preventDefault();
          closeModals();
          return;
        }
        if (isInput) {
          activeEl.blur();
        }
        return;
      }

      // Ctrl + B: Toggle Sidebar collapse/expand
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // F2: Focus primary search bar on current view
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"], input[placeholder*="Filter"], input[placeholder*="search"], input[type="search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // F3: Quick Jump to Sales / POS
      if (e.key === 'F3') {
        e.preventDefault();
        navigateTo('sales', 'pos');
        return;
      }

      // F4 or Alt+N: Add New Record
      if (e.key === 'F4' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
        e.preventDefault();
        // Look for primary add button on page (e.g., button containing "Add", "New", or with class btn-primary in header)
        const addBtn = document.querySelector('button.btn-primary');
        if (addBtn && !isModalOpen) {
          addBtn.click();
        }
        return;
      }

      // F6: Quick Jump to Inventory
      if (e.key === 'F6') {
        e.preventDefault();
        navigateTo('inventory', 'stock');
        return;
      }

      // F7: Quick Jump to Master Business Directories
      if (e.key === 'F7') {
        e.preventDefault();
        navigateTo('masters');
        return;
      }

      // F8: Quick Jump to Reports & Analytics
      if (e.key === 'F8') {
        e.preventDefault();
        navigateTo('reports');
        return;
      }

      // F9 or Ctrl+P: Print Standard ERP Action
      if (e.key === 'F9' || ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P'))) {
        e.preventDefault();
        // Check if there is an active print button in completed receipt modal or table
        const printLink = document.querySelector('.modal-backdrop a[href*="pdf"], a[href*="pdf"], button[title*="Print"], button:has(svg.lucide-printer)');
        if (printLink) {
          printLink.click();
        } else {
          window.print();
        }
        return;
      }

      // F10 or Ctrl+S: Save / Submit Form
      if (e.key === 'F10' || ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S'))) {
        e.preventDefault();
        const submitBtn = document.querySelector('.modal-backdrop form button[type="submit"], form button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        }
        return;
      }

      // Alt + 1..7: Module Navigation Shortcuts
      if (e.altKey && !e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigateTo('dashboard');
            break;
          case '2':
            e.preventDefault();
            navigateTo('inventory', 'stock');
            break;
          case '3':
            e.preventDefault();
            navigateTo('sales', 'pos');
            break;
          case '4':
            e.preventDefault();
            navigateTo('masters', 'products');
            break;
          case '5':
            e.preventDefault();
            navigateTo('masters');
            break;
          case '6':
            e.preventDefault();
            navigateTo('reports');
            break;
          case '7':
            e.preventDefault();
            navigateTo('admin', 'users');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, toggleSidebar, openShortcutsModal, closeModals, navigateTo, isModalOpen]);
}
