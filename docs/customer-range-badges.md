# Customer range badges

Use `CustomerRangeBadge` from `frontend/src/components/CustomerRangeBadge.jsx` for customer range labels throughout the ERP:

```jsx
<CustomerRangeBadge name={customer.currentRangeName} code={customer.currentRangeCode}/>
```

The signed-in application shares one range configuration through `CustomerRangeBadgeProvider`. Range setup screens can pass their latest configuration directly with `ranges={ranges}`.

Badge colours follow active spending thresholds, highest first: gold, silver and bronze for the top three, then blue, violet, rose, indigo, cyan and lime for additional levels (cycling for longer configurations). Equal thresholds share a colour. Range 0 and any active zero-spend baseline use teal; inactive ranges remain neutral. Range names, eligibility, spend amounts and targets remain unchanged.

Setup, dashboard, customer history, POS customer selection, outstanding statements, range progress and staff performance use the same component. Configuration updates refresh the shared badges through target update events. Explicit named tiers and the default Range 0–5 configuration supply a fallback when configuration is unavailable.
