# ERP interface standard

Purchasing is the reference for the ERP's operational interface. All modules use
the existing Inter font stack, sky-blue primary actions, slate text, white panels,
light slate canvas, and flat surfaces. Keep workflows and semantic status colours.

The shared implementation lives in `src/components/ErpDesignSystem.css`, imported
after `style.css` in `main.jsx`. Module styles consume its CSS variables rather
than introducing new font sizes. Keep print templates independent of screen styles.

| Role | Standard |
| --- | --- |
| Page title | 1.65rem, weight 800 |
| Page description | .875rem |
| Module navigation | .92rem, weight 500; active 700 |
| Dialog title | 1.25rem, weight 700 |
| Section heading | 1.15rem |
| Action text | .88rem, weight 600 |
| Form control text | .85rem |
| Table/body text | .84rem |
| Supporting text | .78rem |
| Table heading/caption | .74rem |
| Status badge | .67rem |
| Header action | 40px minimum height, 9px 18px padding, 8px radius |
| Standard action/control | 38px height, 6px radius |
| Primary colour | #0284c7; hover #0369a1 |
| Desktop page spacing | 24px 32px; 16px on tablets, 12px on phones |

Use `erp-page`, `erp-page-header`, `erp-page-title`, and `erp-page-description`
for top-level module headers. Embedded directories must not add another page
padding layer. Purchasing's focused editor sets `data-focused="true"`.

Use `erp-tabs` and `erp-tab` with `data-active` and `aria-pressed` for the current
navigation pattern. Tabs scroll horizontally instead of wrapping or shrinking.
Module navigation hover colour is controlled in one place by `--erp-nav-hover` in
`ErpDesignSystem.css`. Icons inherit text colour through `currentColor`; do not
set per-page icon colour props. Delivery navigation uses labels without counts.
Module tabs show the shared blue underline on hover across every page.
Render module navigation with `ErpTabs` and `ErpTab` from `ErpTabs.jsx`.
Pass tab state and click handlers; keep hover colours, underline, spacing,
and typography in the shared CSS instead of page-specific hover handlers.
Sidebar navigation keeps its text and icon colours on hover and shows a light
background box. Selecting a module changes its active-page colours.
Use `erp-button`, `erp-button-primary`, `erp-field`, `erp-table`,
`erp-table-heading`, and `erp-table-cell` for the corresponding roles. These
roles own typography and dimensions; do not duplicate those inline. Inline styles
may still control layout, numeric alignment, and conditional semantic colours.

Label creation actions **New Supplier**, **New Customer**, **New Employee**,
**New Quotation**, **New Vehicle**, **New Adjustment**, etc. Keep explicit domain
verbs for operations such as **Record Payment**, **Cancel**, and **Process**.

Keep distinct red destructive actions, green successful/processed statuses,
warning states, code identifiers, financial totals, and POS product controls.
Consistency means matching equivalent roles, not flattening the text hierarchy.

The sidebar uses its compact icon layout below 700px; module buttons retain
accessible names. Keyboard focus, disabled controls, and invalid form states
must remain visible. Verify representative directories and editors at desktop
and narrow widths when changing these shared styles.

All module tables follow Purchasing GRN through `src/components/ErpTables.css`.
Change table header colours, padding, borders, hover backgrounds, and icon action
size there. Use `erp-table-frame` for the outer border, `erp-table-scroll` for
the scrolling container, and `erp-table` on the table. Reuse a parent's frame
and scroller instead of nesting another pair. `erp-table-code` marks document
identifiers; `erp-table-actions` aligns actions; `erp-table-icon-action` gives
icon buttons the shared size. Destructive icons use `data-tone="danger"`.
Keep column widths, numeric alignment, and semantic states specific to the data.

Use `StatusBadge` for record states in every table, including clickable active
states. Its shared state mapping controls success, pending, cancelled, voided,
and inactive colours; its CSS owns badge size and the status dot. Do not hardcode
green for payment records or render separate per-page status pills. Table actions
use icon buttons with accessible labels and titles; edit uses `Edit2`, print uses
`Printer`, and destructive actions use the shared danger tone. `TableRowActions`
also uses these same classes instead of separate inline colours and hover rules.
