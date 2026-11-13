/**
 * Official Indian States and Union Territories with 2-digit GST Codes
 * Used for GSTIN validation, State of Supply determination, and CGST/SGST vs IGST calculation.
 */

export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

/**
 * Standard Indian GST Rates
 */
export const GST_RATES = [
  { rate: 0, label: '0% (Exempted / Nil)' },
  { rate: 0.1, label: '0.1%' },
  { rate: 0.25, label: '0.25%' },
  { rate: 3, label: '3% (Gold & Precious)' },
  { rate: 5, label: '5%' },
  { rate: 12, label: '12%' },
  { rate: 18, label: '18% (Standard)' },
  { rate: 28, label: '28% (Luxury)' },
];

/**
 * Standard Business Units
 */
export const STANDARD_UNITS = [
  'PCS',
  'BOX',
  'BAG',
  'KG',
  'GM',
  'QUINTAL',
  'TONNE',
  'LTR',
  'MTR',
  'SQF',
  'SQM',
  'NOS',
  'SET',
  'DOZ',
  'ROL',
  'CAN',
  'BTL',
  'PKT',
];

/**
 * Validates 15-character GSTIN format:
 * 2 digits (State Code) + 5 letters (PAN) + 4 digits + 1 letter + 1 digit/letter (Entity) + 'Z' + 1 checksum character
 */
export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(clean);
}

/**
 * Extract State Code from GSTIN
 */
export function getStateFromGSTIN(gstin: string): IndianState | undefined {
  if (!gstin || gstin.length < 2) return undefined;
  const code = gstin.substring(0, 2);
  return INDIAN_STATES.find(s => s.code === code);
}
