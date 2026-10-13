export function staffCode(staff) {
  const code=String(staff?.employeeCode || '').trim();
  return code || (staff?.id != null ? `EMP-${String(staff.id).padStart(4,'0')}` : '—');
}
