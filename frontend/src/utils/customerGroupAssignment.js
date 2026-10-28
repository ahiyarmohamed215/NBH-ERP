export function conflictingCustomerGroup(customerId, staffId, groups, editedGroupId) {
  if (!staffId) return null;
  return groups.find((group) => {
    const owner = group.assignedStaffId || group.salesmanId || group.salesRepId;
    return String(group.id) !== String(editedGroupId)
      && owner && String(owner) !== String(staffId)
      && (group.customerIds || []).some((id) => String(id) === String(customerId));
  }) || null;
}
