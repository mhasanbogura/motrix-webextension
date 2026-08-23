export interface FilenameMetadata {
  url: string;
  time: number;
  filename?: string;
  fileSize?: number;
}

export class FilenameMetadataStore {
  private metadata = new Map<string, FilenameMetadata>();

  constructor(private ttlMs = 30000) {}

  capture(details: { url: string; responseHeaders?: Array<{ name: string; value?: string }> }): void {
    const disposition = details.responseHeaders?.find(
      (header) => header.name.toLowerCase() === 'content-disposition',
    )?.value;
    const filename = disposition ? parseContentDispositionFilename(disposition) : undefined;
    const contentLength = details.responseHeaders?.find(
      (header) => header.name.toLowerCase() === 'content-length',
    )?.value;
    const fileSize = contentLength ? parsePositiveInteger(contentLength) : undefined;
    if (!filename && fileSize === undefined) return;
    const previous = this.metadata.get(details.url);
    this.metadata.set(details.url, {
      url: details.url,
      filename: filename || previous?.filename,
      fileSize: fileSize ?? previous?.fileSize,
      time: Date.now(),
    });
    this.prune();
  }

  resolve(urls: string[]): FilenameMetadata | undefined {
    this.prune();
    for (const url of urls) {
      const direct = this.metadata.get(url);
      if (direct) return direct;
    }
    return undefined;
  }

  private prune(): void {
    const expiredAt = Date.now() - this.ttlMs;
    for (const [key, value] of this.metadata.entries()) {
      if (value.time < expiredAt) this.metadata.delete(key);
    }
  }
}

export function parseContentDispositionFilename(value: string): string | undefined {
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) return sanitizeFilename(safeDecodeURIComponent(encoded.replaceAll('"', '').trim()));
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(value)?.[1];
  return plain ? sanitizeFilename(plain.trim()) : undefined;
}

export function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

export function filenameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const queryFilename = ['filename', 'file_name', 'name', 'download', 'download_name', 'title']
      .map((key) => parsed.searchParams.get(key))
      .map((value) => value ? sanitizeFilename(safeDecodeURIComponent(value)) : undefined)
      .find((value): value is string => Boolean(value) && !isWeakFilename(value));
    if (queryFilename) return queryFilename;
    const raw = parsed.pathname.split('/').filter(Boolean).pop();
    const pathnameFilename = raw ? sanitizeFilename(safeDecodeURIComponent(raw)) : undefined;
    return pathnameFilename && !isWeakFilename(pathnameFilename) ? pathnameFilename : undefined;
  } catch {
    return undefined;
  }
}

export function isWeakFilename(value: string | undefined): boolean {
  if (!value) return true;
  const stem = value.replace(/\.[a-z0-9]{1,8}$/i, '').toLowerCase();
  return new Set(['download', 'file', 'media', 'video', 'audio', 'blob', 'document', 'untitled']).has(stem);
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
