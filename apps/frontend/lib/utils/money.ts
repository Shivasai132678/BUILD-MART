/**
 * Money utilities for the BuildMart frontend.
 *
 * Backend money fields are Prisma Decimal(10,2) serialised as strings.
 * We keep them as strings throughout and only convert to a safe integer
 * representation (paise = 100ths of a rupee) when comparison is needed.
 * We never use JS floating-point arithmetic on money values.
 */

/**
 * Convert a decimal money string (e.g. "1234.50") to integer paise.
 * Avoids all floating-point precision issues.
 */
export function toPaise(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const str = String(value).trim();
  const [intPart = '0', fracPart = '00'] = str.split('.');
  const paise = parseInt(intPart, 10) * 100 + parseInt(fracPart.slice(0, 2).padEnd(2, '0'), 10);
  return Number.isNaN(paise) ? 0 : paise;
}

/**
 * Format a money string for display in INR.
 * Input: Prisma Decimal string e.g. "12345.00"
 * Output: "₹12,345"  (no decimals for whole rupees) or "₹12,345.50"
 */
export function formatINR(value: string | number | null | undefined): string {
  if (value == null) return '₹0';
  const paise = toPaise(value);
  const rupees = Math.floor(paise / 100);
  const remainderPaise = paise % 100;
  const formatted = rupees.toLocaleString('en-IN');
  return remainderPaise > 0
    ? `₹${formatted}.${String(remainderPaise).padStart(2, '0')}`
    : `₹${formatted}`;
}
