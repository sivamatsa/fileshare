import { TransferHistoryItem } from '../types';

const SESSION_HISTORY_KEY = 'p2p_transfer_history_session';
const MAX_HISTORY = 50;
const HISTORY_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

/**
 * Filter out any transfer history items older than 30 minutes
 */
function pruneExpired(items: TransferHistoryItem[]): TransferHistoryItem[] {
  const now = Date.now();
  return items.filter((item) => {
    const age = now - (item.timestamp || 0);
    return age >= 0 && age < HISTORY_TTL_MS;
  });
}

export function getTransferHistory(): TransferHistoryItem[] {
  try {
    // Migration: clean up any legacy persistent localStorage from prior versions
    if (localStorage.getItem('p2p_transfer_history_v1')) {
      localStorage.removeItem('p2p_transfer_history_v1');
    }

    const raw = sessionStorage.getItem(SESSION_HISTORY_KEY);
    if (!raw) return [];
    
    const parsed: TransferHistoryItem[] = JSON.parse(raw);
    const valid = pruneExpired(parsed);

    // If any items expired, write back pruned list immediately
    if (valid.length !== parsed.length) {
      sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch {
    return [];
  }
}

export function saveTransferHistoryItem(item: TransferHistoryItem): void {
  try {
    const current = getTransferHistory();
    // Ensure the new item timestamp is set
    const itemWithTime = {
      ...item,
      timestamp: item.timestamp || Date.now(),
    };
    
    // Prepend new item and prune any items older than 30 minutes
    const updated = pruneExpired([itemWithTime, ...current.filter((i) => i.id !== item.id)]).slice(0, MAX_HISTORY);
    sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving transfer history:', err);
  }
}

export function clearTransferHistory(): void {
  try {
    sessionStorage.removeItem(SESSION_HISTORY_KEY);
    localStorage.removeItem('p2p_transfer_history_v1');
  } catch (err) {
    console.error('Error clearing transfer history:', err);
  }
}

/**
 * Auto-prunes expired history items and cleans up on session unload
 */
export function autoPruneHistory(): void {
  getTransferHistory();
}

