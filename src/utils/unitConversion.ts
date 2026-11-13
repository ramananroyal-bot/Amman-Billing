/**
 * Weight-based unit conversion helpers for Billing & Inventory.
 * Supported weight units: GM (Grams), KG (Kilograms), QUINTAL (100 KG), TONNE (1,000 KG).
 * All conversions normalize to Kilograms (KG) as the common reference unit.
 */

export const WEIGHT_UNIT_FACTORS_TO_KG: Record<string, number> = {
  GM: 0.001,
  G: 0.001,
  GRAM: 0.001,
  GRAMS: 0.001,
  KG: 1,
  KGS: 1,
  KILOGRAM: 1,
  KILOGRAMS: 1,
  QUINTAL: 100,
  QUINTALS: 100,
  QTL: 100,
  TONNE: 1000,
  TONNES: 1000,
  MT: 1000,
  TON: 1000,
};

export const WEIGHT_UNITS = ['GM', 'KG', 'QUINTAL', 'TONNE'] as const;

/**
 * Returns true if the given unit represents a convertible weight measurement.
 */
export function isWeightUnit(unit?: string): boolean {
  if (!unit) return false;
  return unit.trim().toUpperCase() in WEIGHT_UNIT_FACTORS_TO_KG;
}

/**
 * Normalizes synonymous unit strings (e.g. "Kg" -> "KG", "Tonne" -> "TONNE").
 */
export function normalizeUnit(unit?: string): string {
  const upper = (unit || 'PCS').trim().toUpperCase();
  if (upper === 'G' || upper === 'GRAM' || upper === 'GRAMS') return 'GM';
  if (upper === 'KGS' || upper === 'KILOGRAM' || upper === 'KILOGRAMS') return 'KG';
  if (upper === 'QUINTALS' || upper === 'QTL') return 'QUINTAL';
  if (upper === 'TONNES' || upper === 'MT' || upper === 'TON') return 'TONNE';
  return upper;
}

/**
 * Returns compatible units for an item's base unit.
 * If the item is measured by weight, all weight units (GM, KG, QUINTAL, TONNE) are returned.
 * Otherwise, only the item's own unit is returned.
 */
export function getCompatibleUnits(baseUnit?: string): string[] {
  const norm = normalizeUnit(baseUnit);
  if (isWeightUnit(norm)) {
    return [...WEIGHT_UNITS];
  }
  return [norm || 'PCS'];
}

/**
 * Converts a quantity from one weight unit to another.
 * If either unit is not a convertible weight unit or they belong to non-weight units, returns qty unchanged.
 */
export function convertWeightQty(qty: number, fromUnit?: string, toUnit?: string): number {
  const nQty = Number(qty) || 0;
  if (!fromUnit || !toUnit) return nQty;
  const fromFactor = WEIGHT_UNIT_FACTORS_TO_KG[fromUnit.trim().toUpperCase()];
  const toFactor = WEIGHT_UNIT_FACTORS_TO_KG[toUnit.trim().toUpperCase()];
  if (!fromFactor || !toFactor) return nQty;
  const inKg = nQty * fromFactor;
  const converted = inKg / toFactor;
  return Math.round(converted * 10000) / 10000;
}

/**
 * Scales a per-unit price when the user switches invoice unit (e.g., item is ₹60/KG, sold in QUINTAL -> ₹6,000/QUINTAL).
 */
export function calculateConvertedUnitPrice(basePrice: number, baseUnit?: string, targetUnit?: string): number {
  const price = Number(basePrice) || 0;
  if (!baseUnit || !targetUnit) return price;
  const baseFactor = WEIGHT_UNIT_FACTORS_TO_KG[baseUnit.trim().toUpperCase()];
  const targetFactor = WEIGHT_UNIT_FACTORS_TO_KG[targetUnit.trim().toUpperCase()];
  if (!baseFactor || !targetFactor) return price;
  const converted = price * (targetFactor / baseFactor);
  return Math.round(converted * 100) / 100;
}
