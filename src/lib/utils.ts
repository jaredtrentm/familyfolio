import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  // Handle null, undefined, or NaN values
  const safeAmount = (amount == null || isNaN(amount)) ? 0 : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function formatNumber(value: number | null | undefined, locale: string = 'en-US'): string {
  // Handle null, undefined, or NaN values
  const safeValue = (value == null || isNaN(value)) ? 0 : value;
  // For shares, show up to 8 decimal places but only as many as needed
  const decimalPlaces = getSignificantDecimals(safeValue, 8);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalPlaces,
  }).format(safeValue);
}

// Helper to determine how many decimal places are significant (up to max)
function getSignificantDecimals(value: number, max: number = 8): number {
  // Handle edge cases
  if (value == null || isNaN(value) || !isFinite(value)) return 0;
  if (Number.isInteger(value)) return 0;
  const str = value.toString();
  const decimalIndex = str.indexOf('.');
  if (decimalIndex === -1) return 0;
  const decimals = str.slice(decimalIndex + 1).replace(/0+$/, '').length;
  return Math.min(decimals, max);
}

export function formatPercent(value: number | null | undefined, locale: string = 'en-US'): string {
  // Handle null, undefined, or NaN values
  const safeValue = (value == null || isNaN(value)) ? 0 : value;
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue / 100);
}

export function formatDate(date: Date | string | null | undefined, formatStr: string = 'MMM d, yyyy'): string {
  // Handle null, undefined, or empty string
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return '';
    return format(dateObj, formatStr);
  } catch {
    // Return empty string if date parsing fails
    return '';
  }
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}
