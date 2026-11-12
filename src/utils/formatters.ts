/**
 * Format currency in Indian numbering system (Lakhs, Crores)
 * e.g., 1234567.89 -> "₹ 12,34,567.89"
 */
export function formatINR(amount: number | null | undefined, showSymbol: boolean = true): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return showSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Format ISO date string (YYYY-MM-DD or full ISO) to Indian DD/MM/YYYY
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  try {
    const parts = isoDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoDate || '-';
  }
}

/**
 * Get today's date in YYYY-MM-DD format for HTML date inputs
 */
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert numbers into words according to Indian numbering system (Crores, Lakhs, Thousands, Hundreds)
 */
export function numberToIndianWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';

  const singleDigits = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  ];
  const twoDigits = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertTwoDigits(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n < 20) return twoDigits[n - 10];
    const unit = n % 10;
    return `${tens[Math.floor(n / 10)]} ${unit ? singleDigits[unit] : ''}`.trim();
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += `${singleDigits[hundred]} Hundred `;
    }
    if (rest > 0) {
      res += (hundred > 0 ? 'and ' : '') + convertTwoDigits(rest);
    }
    return res.trim();
  }

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let remaining = rupees;
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  const hundred = remaining;

  let words = '';
  if (crore > 0) words += `${convertTwoDigits(crore)} Crore `;
  if (lakh > 0) words += `${convertTwoDigits(lakh)} Lakh `;
  if (thousand > 0) words += `${convertTwoDigits(thousand)} Thousand `;
  if (hundred > 0) words += `${convertThreeDigits(hundred)} `;

  words = words.trim();
  let result = words ? `${words} Rupees` : 'Zero Rupees';

  if (paise > 0) {
    result += ` and ${convertTwoDigits(paise)} Paise`;
  }

  return `${result} Only`;
}

/**
 * Calculate GST Breakdown based on intra-state vs inter-state
 */
export function calculateTax(
  taxableAmount: number,
  taxRate: number,
  isInterState: boolean
): { cgst: number; sgst: number; igst: number; totalTax: number } {
  if (taxRate <= 0 || taxableAmount <= 0) {
    return { cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
  }

  const taxVal = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;

  if (isInterState) {
    return {
      cgst: 0,
      sgst: 0,
      igst: taxVal,
      totalTax: taxVal,
    };
  } else {
    const halfTax = Math.round((taxVal / 2) * 100) / 100;
    return {
      cgst: halfTax,
      sgst: halfTax,
      igst: 0,
      totalTax: halfTax * 2,
    };
  }
}
