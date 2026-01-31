/**
 * Transaction History Tracking Utilities
 * Handles audit trail and undo functionality for transactions
 */

export type ChangeType = 'CREATE' | 'UPDATE' | 'DELETE' | 'CLAIM' | 'UNCLAIM';

export interface TransactionData {
  id?: string;
  date?: string | Date;
  type?: string;
  symbol?: string;
  description?: string | null;
  quantity?: number;
  price?: number;
  amount?: number;
  fees?: number;
  notes?: string | null;
  claimedById?: string | null;
  accountId?: string | null;
  washSaleFlag?: boolean;
  washSaleAmount?: number | null;
}

export interface HistoryEntry {
  id: string;
  transactionId: string;
  userId: string;
  changeType: ChangeType;
  previousData: TransactionData | null;
  newData: TransactionData | null;
  createdAt: Date;
  user?: {
    name: string;
    email: string;
  };
}

/**
 * Create a history entry object for recording a change
 */
export function createHistoryEntry(
  transactionId: string,
  userId: string,
  changeType: ChangeType,
  previousData: TransactionData | null,
  newData: TransactionData | null
): Omit<HistoryEntry, 'id' | 'createdAt' | 'user'> {
  return {
    transactionId,
    userId,
    changeType,
    previousData: previousData ? sanitizeForJson(previousData) : null,
    newData: newData ? sanitizeForJson(newData) : null,
  };
}

/**
 * Sanitize transaction data for JSON storage
 * Converts Date objects to ISO strings
 */
function sanitizeForJson(data: TransactionData): TransactionData {
  const sanitized = { ...data };

  if (sanitized.date instanceof Date) {
    sanitized.date = sanitized.date.toISOString();
  }

  return sanitized;
}

/**
 * Get a human-readable description of a history entry
 */
export function describeHistoryEntry(entry: HistoryEntry): string {
  const userName = entry.user?.name || 'Unknown user';

  switch (entry.changeType) {
    case 'CREATE':
      return `${userName} created this transaction`;

    case 'DELETE':
      return `${userName} deleted this transaction`;

    case 'CLAIM':
      return `${userName} claimed this transaction`;

    case 'UNCLAIM':
      return `${userName} unclaimed this transaction`;

    case 'UPDATE': {
      const changes = getChangedFields(entry.previousData, entry.newData);
      if (changes.length === 0) {
        return `${userName} updated this transaction`;
      }
      return `${userName} changed ${changes.join(', ')}`;
    }

    default:
      return `${userName} modified this transaction`;
  }
}

/**
 * Get list of fields that changed between two transaction states
 */
function getChangedFields(
  previous: TransactionData | null,
  next: TransactionData | null
): string[] {
  if (!previous || !next) return [];

  const changes: string[] = [];
  const fields: (keyof TransactionData)[] = [
    'date', 'type', 'symbol', 'quantity', 'price', 'amount', 'fees', 'notes', 'description'
  ];

  for (const field of fields) {
    const prevVal = previous[field];
    const nextVal = next[field];

    if (prevVal !== nextVal) {
      changes.push(formatFieldName(field));
    }
  }

  return changes;
}

/**
 * Format field name for display
 */
function formatFieldName(field: keyof TransactionData): string {
  const names: Record<string, string> = {
    date: 'date',
    type: 'type',
    symbol: 'symbol',
    quantity: 'quantity',
    price: 'price',
    amount: 'amount',
    fees: 'fees',
    notes: 'notes',
    description: 'description',
    claimedById: 'claimed by',
    accountId: 'account',
    washSaleFlag: 'wash sale flag',
    washSaleAmount: 'wash sale amount',
  };
  return names[field] || field;
}

/**
 * Check if a transaction can be reverted to a previous state
 */
export function canRevertTo(entry: HistoryEntry): boolean {
  // Can revert UPDATE and UNCLAIM
  // Cannot revert CREATE (would need to delete) or DELETE (transaction is gone)
  return entry.changeType === 'UPDATE' || entry.changeType === 'UNCLAIM';
}

/**
 * Get the data needed to revert a transaction to a previous state
 */
export function getRevertData(entry: HistoryEntry): TransactionData | null {
  if (!canRevertTo(entry)) return null;
  return entry.previousData;
}

/**
 * Format date for history display
 */
export function formatHistoryDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Group history entries by date
 */
export function groupHistoryByDate(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const groups = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = date.toDateString();

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(entry);
  }

  return groups;
}
