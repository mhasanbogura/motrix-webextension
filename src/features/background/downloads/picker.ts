import type { AddDownloadInput } from '@/library/rpc';
import type { StorageSnapshot } from '@/library/storage';
import type { RuntimeResponse } from '@/library/messages';

import { loadSnapshot } from '@/library/storage';
import { sanitizeFilename } from '@/library/download/filename-metadata';

import { routeDownloadInput } from './route-download-input';

export interface PendingPicker {
  id: string;
  source: string;
  createdAt: number;
  input: AddDownloadInput;
}

const PICKER_KEY_PREFIX = 'motrix-picker:';

function storageKey(id: string): string {
  return `${PICKER_KEY_PREFIX}${id}`;
}

function safeOutputName(value: string | undefined, fallback = 'download'): string {
  const cleaned = sanitizeFilename(value || fallback).replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

export async function openDownloadPicker(input: AddDownloadInput, source: string): Promise<string> {
  const id = crypto.randomUUID();
  const pending: PendingPicker = { id, input, source, createdAt: Date.now() };
  await browser.storage.local.set({ [storageKey(id)]: pending });
  const pickerUrl = browser.runtime.getURL(`/picker.html?id=${encodeURIComponent(id)}`);
  try {
    await browser.windows.create({ url: pickerUrl, type: 'popup', width: 560, height: 520 });
  } catch {
    await browser.tabs.create({ url: pickerUrl });
  }
  return id;
}

export async function getPendingPicker(id: string): Promise<PendingPicker | undefined> {
  const stored = await browser.storage.local.get(storageKey(id));
  const pending = stored[storageKey(id)] as PendingPicker | undefined;
  if (!pending) return undefined;
  if (Date.now() - pending.createdAt > 30 * 60 * 1000) {
    await deletePendingPicker(id);
    return undefined;
  }
  return pending;
}

export async function deletePendingPicker(id: string): Promise<void> {
  await browser.storage.local.remove(storageKey(id));
}

export async function submitPendingPicker(
  id: string,
  filename: string,
): Promise<void> {
  const pending = await getPendingPicker(id);
  if (!pending) throw new Error('The download picker request has expired');
  const snapshot = await loadSnapshot();
  const input: AddDownloadInput = {
    ...pending.input,
    filename: safeOutputName(filename, pending.input.filename || 'download'),
    dir: snapshot.settings.defaultDir || undefined,
  };
  await routeDownloadInput(input, snapshot, `${pending.source}_picker`);
  await deletePendingPicker(id);
}

export async function cancelPendingPicker(id: string): Promise<void> {
  await deletePendingPicker(id);
}

export async function handlePickerMessage(message: {
  type: 'picker:get' | 'picker:submit' | 'picker:cancel';
  id: string;
  filename?: string;
}): Promise<RuntimeResponse> {
  if (message.type === 'picker:get') {
    const pending = await getPendingPicker(message.id);
    return pending ? { ok: true, result: pending } : { ok: false, code: 'picker_expired', message: 'The download picker request has expired' };
  }
  if (message.type === 'picker:cancel') {
    await cancelPendingPicker(message.id);
    return { ok: true };
  }
  await submitPendingPicker(message.id, message.filename || '');
  return { ok: true };
}

export function pickerInputDefaults(pending: PendingPicker): { filename: string } {
  return { filename: safeOutputName(pending.input.filename, 'download') };
}

export type PickerSnapshot = StorageSnapshot;
