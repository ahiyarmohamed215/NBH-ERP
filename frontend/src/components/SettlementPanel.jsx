import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { paymentApi } from '../api/apiClient';

export default function SettlementPanel() {
  const { user } = useAuth();
  const canManage = user?.roles?.some(r => ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'].includes(r)) || user?.permissions?.includes('PAYMENT_CREATE');
  const [records, setRecords] = useState([]), [credits, setCredits] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: 'advance', source: '', invoice: '', amount: '' });

  const load = async () => {
    try {
      const [p, c] = await Promise.all([
        paymentApi.search({ paymentType: 'ADVANCE', status: 'COMPLETED' }),
        api.get('/credit-notes'),
      ]);
      setRecords(p.data.content);
      setCredits(c.data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      if (form.kind === 'advance') {
        await paymentApi.allocate(Number(form.source), { invoiceId: Number(form.invoice), amount: Number(form.amount) });
      } else {
        await api.post(`/credit-notes/${form.source}/apply`, { invoiceId: Number(form.invoice), amount: Number(form.amount) });
      }
      setForm({ ...form, amount: '' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ border: '1px solid #cbd5e1', padding: 16, marginBottom: 16, background: '#fff', maxHeight: 360, overflow: 'auto' }}>
      <h3>Apply advances and credit notes</h3>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {canManage && (
        <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>
            Source
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value, source: '' })}>
              <option value="advance">Advance</option>
              <option value="credit">Credit note</option>
            </select>
          </label>
          <label>
            Credit
            <select required value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              <option value="">Select</option>
              {(form.kind === 'advance' ? records : credits).map(r => (
                <option key={r.id} value={r.id}>
                  {r.paymentNumber || r.number} · {r.customerName || `Customer ${r.customerId}`} · {form.kind === 'credit' ? `Available ${r.available}` : `Receipt ${r.amount}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Invoice ID
            <input required type="number" min="1" value={form.invoice} onChange={e => setForm({ ...form, invoice: e.target.value })} />
          </label>
          <label>
            Amount
            <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </label>
          <button className="btn btn-primary" disabled={busy}>Apply credit</button>
        </form>
      )}
    </section>
  );
}
