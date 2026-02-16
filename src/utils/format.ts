/** Shared formatting utilities used across PRUVIQ components */

export function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 3 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function formatVolume(v: number, prefix = '$'): string {
  if (v >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${prefix}${(v / 1e3).toFixed(0)}K`;
  return `${prefix}${v.toFixed(0)}`;
}

export function formatVolumeRaw(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(1);
}

export function formatUsd(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatReasonLabel(reason: string): string {
  if (reason === 'TP') return 'TP';
  if (reason === 'SL') return 'SL';
  if (reason === 'TIMEOUT') return 'TO';
  return reason;
}

export function changeColor(v: number): string {
  return v >= 0 ? 'var(--color-up)' : 'var(--color-down)';
}

export function fgColor(idx: number): string {
  if (idx <= 25) return 'var(--color-fg-extreme-fear)';
  if (idx <= 45) return 'var(--color-fg-fear)';
  if (idx <= 55) return 'var(--color-fg-neutral)';
  if (idx <= 75) return 'var(--color-fg-greed)';
  return 'var(--color-fg-extreme-greed)';
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 60000);
    if (diff < 1) return 'now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  } catch {
    return '';
  }
}
