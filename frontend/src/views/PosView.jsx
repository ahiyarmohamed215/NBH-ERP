import React, { useState, useEffect, useRef } from 'react';
import { productApi, warehouseApi, customerApi, salesApi, inventoryApi, pdfApi } from '../api/apiClient';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  CheckCircle,
  Printer,
  CreditCard,
  Banknote,
  Clock,
  User,
  ShieldAlert,
  X
} from 'lucide-react';

export default function PosView() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const isSupervisor = user?.roles?.includes('ROLE_ADMIN') || user?.permissions?.includes('SALES_VIEW_ALL');

  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  const [heldInvoices, setHeldInvoices] = useState([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [heldTab, setHeldTab] = useState('mine'); // 'mine' | 'all'

  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentType, setPaymentType] = useState('CASH');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [processing, setProcessing] = useState(false);

  const searchInputRef = useRef(null);

  useEffect(() => {
    loadInitialData();
    loadHeldInvoices();
  }, []);

  const loadInitialData = async () => {
    try {
      const [whRes, custRes] = await Promise.all([
        warehouseApi.getActive(),
        customerApi.getActive()
      ]);
      setWarehouses(whRes.data || []);
      const primary = whRes.data?.find((w) => w.isPrimary) || whRes.data?.[0];
      if (primary) setSelectedWarehouseId(primary.id);

      setCustomers(custRes.data || []);
      const defaultCust = custRes.data?.find((c) => c.customerCode === 'CUST-0001') || custRes.data?.[0];
      if (defaultCust) setSelectedCustomerId(defaultCust.id);
    } catch (err) {
      addToast('Error loading master data: ' + err.message, 'error');
    }
  };

  const loadHeldInvoices = async () => {
    try {
      const res = await salesApi.getHeld();
      setHeldInvoices(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProductSearch = async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await productApi.searchActive(query);
      setSearchResults(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = async (product) => {
    let availableQty = 0;
    if (selectedWarehouseId) {
      try {
        const stockRes = await inventoryApi.getWarehouseStock(selectedWarehouseId);
        const itemStock = stockRes.data?.find((s) => s.productId === product.id);
        availableQty = itemStock ? Number(itemStock.availableQuantity) : 0;
      } catch (e) {}
    }

    setCart((prev) => {
      const exists = prev.find((item) => item.productId === product.id);
      if (exists) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitOfMeasure: product.unitOfMeasure,
          quantity: 1,
          unitPrice: Number(product.sellingPrice),
          discountRate: 0,
          discountAmount: 0,
          total: Number(product.sellingPrice),
          availableQty,
        },
      ];
    });

    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = Math.max(1, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              total: newQty * item.unitPrice - item.discountAmount,
            };
          }
          return item;
        })
    );
  };

  const setItemQuantity = (productId, qtyVal) => {
    const val = parseFloat(qtyVal) || 1;
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: val, total: val * item.unitPrice - item.discountAmount }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountVal = Math.min(subtotal, Number(discountAmount) || 0);
  const taxable = Math.max(0, subtotal - discountVal);
  const taxAmount = (taxable * (Number(taxRate) || 0)) / 100;
  const netTotal = taxable + taxAmount;

  // Tender change
  const tendered = parseFloat(tenderedAmount) || netTotal;
  const changeDue = Math.max(0, tendered - netTotal);

  const handleHoldCart = async () => {
    if (cart.length === 0) {
      addToast('Cart is empty. Add items first.', 'error');
      return;
    }
    try {
      const payload = {
        warehouseId: selectedWarehouseId,
        customerId: selectedCustomerId,
        discountAmount: discountVal,
        taxRate: Number(taxRate),
        hold: true,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };
      await salesApi.create(payload);
      addToast('Cart successfully placed on HOLD', 'info');
      setCart([]);
      loadHeldInvoices();
    } catch (err) {
      addToast('Failed to hold cart: ' + err.message, 'error');
    }
  };

  const handleResumeInvoice = async (heldInv) => {
    setSelectedWarehouseId(heldInv.warehouseId);
    setSelectedCustomerId(heldInv.customerId);
    setDiscountAmount(heldInv.discountAmount);
    setTaxRate(heldInv.taxRate);

    const reconstructedCart = (heldInv.items || []).map((i) => ({
      productId: i.productId,
      sku: i.productSku,
      name: i.productName,
      unitOfMeasure: i.unitOfMeasure,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountAmount: i.discountAmount || 0,
      total: i.totalPrice,
      availableQty: 99,
    }));

    setCart(reconstructedCart);
    try {
      await salesApi.cancelHeld(heldInv.id); // clean up old held record
    } catch (e) {
      console.error('Failed to cancel held bill on resume:', e);
    }
    await loadHeldInvoices();
    setShowHeldModal(false);
    addToast(`Resumed held bill ${heldInv.invoiceNumber}`, 'success');
  };

  const handleDiscardHeld = async (heldInv) => {
    if (!window.confirm(`Discard held bill ${heldInv.invoiceNumber}?`)) return;
    try {
      await salesApi.cancelHeld(heldInv.id);
      addToast(`Held bill ${heldInv.invoiceNumber} discarded`, 'info');
      await loadHeldInvoices();
    } catch (err) {
      addToast('Failed to discard held bill: ' + err.message, 'error');
    }
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      addToast('Cannot checkout an empty cart', 'error');
      return;
    }

    try {
      setProcessing(true);
      const payload = {
        warehouseId: selectedWarehouseId,
        customerId: selectedCustomerId,
        paymentType,
        discountAmount: discountVal,
        taxRate: Number(taxRate),
        paidAmount: paymentType === 'CREDIT' ? 0 : tendered,
        hold: false,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
        })),
      };

      const res = await salesApi.create(payload);
      setCompletedInvoice(res.data);
      setShowPayModal(false);
      setCart([]);
      setTenderedAmount('');

      // Confetti celebratory burst
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      addToast(`Sale ${res.data.invoiceNumber} completed! Inventory deducted.`, 'success');
    } catch (err) {
      addToast(err.message || 'Checkout failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: '28px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      {/* Left Column: Product Selection & Cart (Takes 65%) */}
      <div style={{ flex: '1 1 640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Controls: Warehouse, Customer, Cashier & Hold Bills */}
        <div className="glass-card" style={{ padding: '18px 24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              SOURCE WAREHOUSE
            </label>
            <select
              className="input-glass"
              value={selectedWarehouseId || ''}
              onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} {wh.isPrimary ? '(Primary)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              CUSTOMER
            </label>
            <select
              className="input-glass"
              value={selectedCustomerId || ''}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customerCode})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              CASHIER SESSION
            </label>
            <div
              style={{
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              <User size={15} color="#2563eb" />
              <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.fullName || user?.username || 'Cashier'}
              </span>
              {isSupervisor && (
                <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                  Admin
                </span>
              )}
            </div>
          </div>

          <button
            className="btn btn-glass"
            style={{ alignSelf: 'flex-end', height: '42px', position: 'relative' }}
            onClick={() => setShowHeldModal(true)}
          >
            <Clock size={16} color="#f59e0b" /> Held Carts
            {heldInvoices.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {heldInvoices.length}
              </span>
            )}
          </button>
        </div>

        {/* Product Search Bar */}
        <div className="glass-card" style={{ padding: '18px 24px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
            <input
              ref={searchInputRef}
              type="text"
              className="input-glass"
              style={{ paddingLeft: '44px', width: '100%' }}
              placeholder="Search product name or SKU..."
              value={searchQuery}
              onChange={(e) => handleProductSearch(e.target.value)}
              autoFocus
            />

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div
                className="glass-card"
                style={{
                  position: 'absolute',
                  top: '48px',
                  left: 0,
                  right: 0,
                  zIndex: 200,
                  maxHeight: '260px',
                  overflowY: 'auto',
                  background: 'rgba(255, 255, 255, 0.98)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
                  padding: '8px 0',
                }}
              >
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    style={{
                      padding: '10px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        SKU: {p.sku} | Unit: {p.unitOfMeasure}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#2563eb' }}>
                        Rs. {Number(p.sellingPrice).toFixed(2)}
                      </div>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        Add to Cart +
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Cart Table */}
        <div className="glass-card" style={{ padding: '24px', flex: 1, minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a' }}>
              Order Items ({cart.length})
            </h3>
            {cart.length > 0 && (
              <button
                className="btn btn-glass btn-sm"
                onClick={() => setCart([])}
                style={{ color: '#ef4444' }}
              >
                Clear Cart
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 0' }}>
                      <Search size={40} style={{ opacity: 0.3, marginBottom: '8px' }} /><br />
                      Search product catalog above to begin checkout
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {item.sku} ({item.unitOfMeasure})
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>Rs. {item.unitPrice.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-glass btn-sm"
                            style={{ padding: '3px 8px' }}
                            onClick={() => updateQuantity(item.productId, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            className="input-glass"
                            style={{ width: '54px', textAlign: 'center', padding: '4px' }}
                            value={item.quantity}
                            onChange={(e) => setItemQuantity(item.productId, e.target.value)}
                          />
                          <button
                            className="btn btn-glass btn-sm"
                            style={{ padding: '3px 8px' }}
                            onClick={() => updateQuantity(item.productId, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        Rs. {item.total.toFixed(2)}
                      </td>
                      <td>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Order Summary & Checkout (Takes 35%) */}
      <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '28px', position: 'sticky', top: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: '20px' }}>Bill Summary</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: 600 }}>Rs. {subtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569', fontSize: '0.88rem' }}>Discount (Rs.):</span>
              <input
                type="number"
                className="input-glass"
                style={{ width: '100px', textAlign: 'right', padding: '4px 8px' }}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#475569', fontSize: '0.88rem' }}>Tax Rate (%):</span>
              <input
                type="number"
                className="input-glass"
                style={{ width: '100px', textAlign: 'right', padding: '4px 8px' }}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            {taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Tax Amount:</span>
                <span>Rs. {taxAmount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ height: '1px', background: 'rgba(226, 232, 240, 0.8)', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>NET TOTAL:</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-heading)' }}>
                Rs. {netTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1.05rem', borderRadius: '10px' }}
              disabled={cart.length === 0}
              onClick={() => {
                setTenderedAmount(netTotal.toFixed(2));
                setShowPayModal(true);
              }}
            >
              <CheckCircle size={20} /> Proceed to Payment
            </button>

            <button
              className="btn btn-glass"
              style={{ width: '100%', padding: '12px' }}
              disabled={cart.length === 0}
              onClick={handleHoldCart}
            >
              <PauseCircle size={18} color="#f59e0b" /> Hold Bill (Save Draft)
            </button>
          </div>
        </div>
      </div>

      {/* Payment Tender Modal */}
      {showPayModal && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.3rem', color: '#0f172a' }}>Tender Payment</h3>
              <button
                onClick={() => setShowPayModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', textAlign: 'center', padding: '16px', background: 'rgba(239, 246, 255, 0.6)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>TOTAL AMOUNT PAYABLE</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-heading)' }}>
                Rs. {netTotal.toFixed(2)}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                PAYMENT METHOD
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {['CASH', 'CARD', 'CREDIT', 'BANK_TRANSFER'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`btn ${paymentType === method ? 'btn-primary' : 'btn-glass'}`}
                    style={{ padding: '10px 4px', fontSize: '0.78rem', fontWeight: 700 }}
                    onClick={() => setPaymentType(method)}
                  >
                    {method.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {paymentType === 'CASH' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  AMOUNT TENDERED (Rs.)
                </label>
                <input
                  type="number"
                  className="input-glass"
                  style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748b' }}>Change Due to Customer:</span>
                  <span style={{ fontWeight: 700, color: changeDue >= 0 ? '#10b981' : '#ef4444' }}>
                    Rs. {changeDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '14px', fontSize: '1.05rem', borderRadius: '10px' }}
              disabled={processing}
              onClick={handleCompleteSale}
            >
              {processing ? 'Processing Transaction...' : 'Complete & Generate Receipt'}
            </button>
          </div>
        </div>
      )}

      {/* Post-Sale Completed Receipt Dialog */}
      {completedInvoice && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '440px', padding: '32px', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CheckCircle size={36} />
            </div>

            <h3 style={{ fontSize: '1.4rem', color: '#0f172a', marginBottom: '6px' }}>Sale Completed!</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
              Invoice <strong>{completedInvoice.invoiceNumber}</strong> has been logged and stock balances deducted.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={pdfApi.getInvoicePdfUrl(completedInvoice.id)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ padding: '12px' }}
              >
                <Printer size={18} /> Print Thermal / A4 Receipt
              </a>
              <button
                className="btn btn-glass"
                onClick={() => setCompletedInvoice(null)}
              >
                Start New Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Carts Modal */}
      {showHeldModal && (
        <div className="modal-backdrop">
          <div className="glass-modal" style={{ width: '100%', maxWidth: '620px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                  {isSupervisor ? 'Suspended / Held Carts' : 'My Suspended Bills'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  {isSupervisor
                    ? 'Supervise and resume carts across active cashier sessions'
                    : 'Your personal held transactions waiting to be completed'}
                </p>
              </div>
              <button
                onClick={() => setShowHeldModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {isSupervisor && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setHeldTab('mine')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: heldTab === 'mine' ? '#2563eb' : '#e2e8f0',
                    background: heldTab === 'mine' ? '#eff6ff' : '#ffffff',
                    color: heldTab === 'mine' ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  My Held Carts ({heldInvoices.filter((h) => h.createdBy === user?.username).length})
                </button>
                <button
                  type="button"
                  onClick={() => setHeldTab('all')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: heldTab === 'all' ? '#2563eb' : '#e2e8f0',
                    background: heldTab === 'all' ? '#eff6ff' : '#ffffff',
                    color: heldTab === 'all' ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  All Cashiers ({heldInvoices.length})
                </button>
              </div>
            )}

            {(() => {
              const displayed =
                isSupervisor && heldTab === 'mine'
                  ? heldInvoices.filter((h) => h.createdBy === user?.username)
                  : heldInvoices;

              if (displayed.length === 0) {
                return (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '0.9rem' }}>
                    No suspended bills found.
                  </p>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {displayed.map((held) => (
                    <div
                      key={held.id}
                      className="glass-card"
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>{held.invoiceNumber}</span>
                          {held.createdBy && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#4338ca',
                                background: '#e0e7ff',
                                padding: '1px 7px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              Cashier: {held.createdBy}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Customer: {held.customerName} | {held.items?.length || 0} items
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                          Rs. {Number(held.netTotal).toFixed(2)}
                        </span>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleResumeInvoice(held)}
                        >
                          <PlayCircle size={14} /> Resume
                        </button>
                        <button
                          className="btn btn-glass btn-sm"
                          title="Discard held bill"
                          onClick={() => handleDiscardHeld(held)}
                          style={{ color: '#ef4444', padding: '6px 8px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
