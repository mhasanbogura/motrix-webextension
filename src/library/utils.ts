import { twMerge } from 'tailwind-merge';
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(value: number | string | undefined, suffix = 'B'): string {
  const bytes = typeof value === 'string' ? Number(value) : value;
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return `0 ${suffix}`;
  const units = [suffix, `Ki${suffix}`, `Mi${suffix}`, `Gi${suffix}`, `Ti${suffix}`];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** exponent;
  const formattedAmount = exponent === 0
    ? amount.toFixed(0)
    : amount >= 100
      ? amount.toFixed(0)
      : amount.toFixed(1);
  return `${formattedAmount} ${units[exponent]}`;
}

export function formatSpeed(value: number | string | undefined): string {
  return `${formatBytes(value)}/s`;
}

export function formatRemainingTime(
  completed: string | number | undefined,
  total: string | number | undefined,
  speed: string | number | undefined,
): string {
  const completedBytes = Number(completed);
  const totalBytes = Number(total);
  const bytesPerSecond = Number(speed);
  if (!Number.isFinite(completedBytes) || !Number.isFinite(totalBytes) || !Number.isFinite(bytesPerSecond)) return '--';
  if (totalBytes <= 0 || bytesPerSecond <= 0 || completedBytes >= totalBytes) return '--';

  const totalSeconds = Math.ceil((totalBytes - completedBytes) / bytesPerSecond);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function percent(completed: string | number, total: string | number): number {
  const done = Number(completed);
  const all = Number(total);
  if (!all || Number.isNaN(done) || Number.isNaN(all)) return 0;
  return Math.min(100, Math.max(0, (done / all) * 100));
}
