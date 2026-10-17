import React, { useEffect, useState } from "react";
import { X, Play, Search, RefreshCw } from "lucide-react";
import { salesApi } from "../api/apiClient";
import { posMoney } from "./PosRangeProgress";
export default function PosHeldBills({
  activeBillId,
  busy,
  onResume,
  onClose,
}) {
  const [scope, setScope] = useState("mine"),
    [query, setQuery] = useState(""),
    [workspace, setWorkspace] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await salesApi.getHeldWorkspace({
          scope,
          query,
          excludeId: activeBillId || undefined,
        });
        if (alive) setWorkspace(response.data?.data || response.data);
      } catch (error) {
        if (alive) setError(error.message || "Unable to load held bills.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    const timer = setTimeout(load, 200),
      interval = setInterval(load, 60000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [scope, query, activeBillId, revision]);
  return (
    <div className="modal-backdrop pos-overlay" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-held-title"
        className="pos-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pos-dialog-heading">
          <div>
            <h2 id="pos-held-title">Held bills</h2>
            <p>
              Saved orders for invoicing. Merge held bills from the Held bills
              page.
            </p>
          </div>
          <button
            className="erp-table-icon-action"
            aria-label="Close held bills"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="pos-dialog-body">
          <div
            className="pos-held-tabs"
            role="tablist"
            aria-label="Held bill owner"
          >
            <button
              role="tab"
              aria-selected={scope === "mine"}
              onClick={() => setScope("mine")}
            >
              My bills
            </button>
            <button
              role="tab"
              aria-selected={scope === "others"}
              onClick={() => setScope("others")}
            >
              Other bills
            </button>
          </div>
          {workspace ? (
            <div className="pos-held-month">
              <div>
                <span>
                  {workspace.periodStart} — {workspace.periodEnd}
                </span>
                <strong>
                  {posMoney(
                    scope === "mine"
                      ? workspace.mineAmount
                      : workspace.othersAmount,
                  )}
                </strong>
              </div>
              <p>
                {scope === "mine" ? workspace.mineCount : workspace.othersCount}{" "}
                bills this month · includes bills already merged into invoices
              </p>
            </div>
          ) : null}
          <div className="pos-held-filters">
            <label className="pos-search">
              <Search size={15} />
              <input
                className="erp-field input-glass"
                aria-label="Search held bills"
                placeholder="Search held number, customer or staff"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="erp-table-icon-action"
              aria-label="Refresh held bills"
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw size={15} />
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <div className="erp-table-scroll erp-table-frame">
            <table className="erp-table">
              <thead>
                <tr>
                  {[
                    "Held number",
                    "Customer",
                    "Saved",
                    "Items",
                    "Amount",
                    "Actions",
                  ].map((label) => (
                    <th className="erp-table-heading" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && !error
                  ? (workspace?.bills || []).map((bill) => (
                      <tr key={bill.id}>
                        <td className="erp-table-cell erp-table-code">
                          {bill.heldNumber}
                          <small className="pos-muted">{bill.createdBy}</small>
                        </td>
                        <td className="erp-table-cell">{bill.customerName}</td>
                        <td className="erp-table-cell">
                          {bill.createdAt
                            ? new Date(bill.createdAt).toLocaleString()
                            : bill.invoiceDate}
                        </td>
                        <td className="erp-table-cell">
                          {bill.items?.length || 0}
                        </td>
                        <td className="erp-table-cell">
                          {posMoney(bill.netTotal)}
                        </td>
                        <td className="erp-table-cell">
                          {bill.canResume ? (
                            <button
                              className="btn btn-secondary erp-button"
                              disabled={busy}
                              onClick={() => onResume(bill)}
                            >
                              <Play size={13} /> Resume
                            </button>
                          ) : (
                            <span className="pos-muted">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  : null}
                {loading || !workspace?.bills?.length ? (
                  <tr>
                    <td colSpan={6} className="erp-table-cell pos-empty">
                      {loading
                        ? "Loading held bills…"
                        : "No open held bills found."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {workspace ? (
            <p className="pos-muted">
              Open bills shown: {posMoney(workspace.visibleAmount)}
            </p>
          ) : null}
        </div>
        <footer className="pos-dialog-footer">
          <button className="btn btn-secondary erp-button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
