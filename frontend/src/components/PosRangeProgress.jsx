import React from "react";
import { X } from "lucide-react";
export const posMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function RangeMeter({ milestone, label }) {
  if (!milestone) return null;
  return (
    <div
      className="pos-meter"
      role="progressbar"
      aria-label={label || milestone.name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={
        Number(milestone.completedPercent) + Number(milestone.billPercent)
      }
      aria-valuetext={`${posMoney(milestone.projectedAmount)} of ${posMoney(milestone.goal)}`}
    >
      <span style={{ width: `${milestone.completedPercent}%` }} />
      <span
        className="pos-meter-bill"
        style={{ width: `${milestone.billPercent}%` }}
      />
    </div>
  );
}
function Milestone({ value }) {
  return (
    <div className="pos-milestone">
      <div className="pos-split">
        <strong>{value.name}</strong>
        <span>{posMoney(value.goal)}</span>
      </div>
      <RangeMeter milestone={value} />
      <div className="pos-split pos-muted">
        <span>{value.reward || "Purchase milestone"}</span>
        <span>
          {value.state === "ACHIEVED"
            ? "Achieved"
            : value.state === "WITH_BILL"
              ? "Reached with this bill"
              : `${posMoney(value.remaining)} to go`}
        </span>
      </div>
    </div>
  );
}
export default function PosRangeProgress({
  customer,
  progress,
  loading,
  onClose,
}) {
  return (
    <div className="modal-backdrop pos-overlay" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-ranges-title"
        className="pos-dialog pos-range-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pos-dialog-heading">
          <div>
            <h2 id="pos-ranges-title">Ranges & targets</h2>
            <p>
              {customer?.name} · {progress?.periodStart} — {progress?.periodEnd}
            </p>
          </div>
          <button
            className="erp-table-icon-action"
            aria-label="Close ranges"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="pos-dialog-body">
          {loading ? (
            <p className="pos-muted">Loading progress…</p>
          ) : !progress ? (
            <p className="pos-muted">
              Progress is unavailable. Close and reopen after saving the bill.
            </p>
          ) : (
            <>
              <div className="pos-range-summary">
                <div>
                  <span>Completed this month</span>
                  <strong>{posMoney(progress.monthlyPurchases)}</strong>
                </div>
                <div>
                  <span>This held bill</span>
                  <strong>{posMoney(progress.currentBillAmount)}</strong>
                </div>
                <div>
                  <span>After invoicing</span>
                  <strong>
                    {posMoney(progress.projectedMonthlyPurchases)}
                  </strong>
                </div>
              </div>
              <div className="pos-meter-key">
                <span>Completed purchases</span>
                <span>This bill (preview)</span>
              </div>
              <h3>Monthly ranges · {progress.currentRangeName}</h3>
              {progress.ranges.map((value, index) => (
                <Milestone key={index} value={value} />
              ))}
              <h3>Campaign targets</h3>
              {progress.targets.length ? (
                progress.targets.map((target, index) => (
                  <section className="pos-campaign" key={index}>
                    <div className="pos-split">
                      <strong>{target.name}</strong>
                      <span className="pos-muted">Ends {target.endDate}</span>
                    </div>
                    {target.milestones.map((value, key) => (
                      <Milestone key={key} value={value} />
                    ))}
                  </section>
                ))
              ) : (
                <p className="pos-muted">
                  No active campaign targets for this customer.
                </p>
              )}
              <p className="pos-muted">
                Held bills are previews. Progress is confirmed when an invoice
                is created.
              </p>
            </>
          )}
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
