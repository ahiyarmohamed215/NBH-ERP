// Keep editing text empty when cleared, and strip redundant leading zeros.
export function normalizeNumericInput(value) {
  return String(value ?? '').replace(/^0+(?=\d)/, '');
}

export function readNumericInput(event) {
  const value = normalizeNumericInput(event.target.value);
  if (event.target.value !== value) event.target.value = value;
  return value;
}
