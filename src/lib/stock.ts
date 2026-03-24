export function getAvailableStock(input: {
  qty_available?: number | null;
  qty_on_hand?: number | null;
  qty_allocated?: number | null;
}): number {
  const qtyOnHand = Number(input.qty_on_hand);
  const qtyAllocated = Number(input.qty_allocated);
  const derivedAvailable =
    Number.isFinite(qtyOnHand) || Number.isFinite(qtyAllocated)
      ? Math.max((Number.isFinite(qtyOnHand) ? qtyOnHand : 0) - (Number.isFinite(qtyAllocated) ? qtyAllocated : 0), 0)
      : Number.NaN;

  const rawAvailable = Number(input.qty_available);
  if (!Number.isFinite(rawAvailable)) {
    return Number.isFinite(derivedAvailable) ? derivedAvailable : 0;
  }

  const normalizedAvailable = Math.max(rawAvailable, 0);
  if (normalizedAvailable === 0 && Number.isFinite(derivedAvailable) && derivedAvailable > 0) {
    return derivedAvailable;
  }

  return normalizedAvailable;
}
