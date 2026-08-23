import type { AddDownloadInput } from '@/library/rpc';

export interface SocialResolverRequest {
  url: string;
  cookie?: string;
  action?: 'resolve';
  userAgent?: string;
}

interface NativeRenameRequest {
  path: string;
  action: 'rename';
  filename: string;
}

export interface SocialResolverResponse {
  ok: boolean;
  ext?: string;
  url?: string;
  mime?: string;
  error?: string;
  title?: string;
  filename?: string;
  fileSize?: number;
  headers?: Record<string, string>;
}

interface NativeMessagingRuntime {
  sendNativeMessage: (hostName: string, message: SocialResolverRequest | NativeRenameRequest) => Promise<unknown>;
}

const NATIVE_HOST_NAME = 'com.motrix.social_resolver';
const SOCIAL_HOSTS = new Set(['facebook.com', 'fb.watch', 'dailymotion.com', 'dai.ly', 'pornhub.com', 'youtube.com', 'youtu.be']);

export function isPornhubUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'pornhub.com' || hostname.endsWith('.pornhub.com');
  } catch {
    return false;
  }
}

export function isSocialMediaUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return [...SOCIAL_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function formatSocialResolverError(error: unknown, pageUrl?: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (pageUrl && isPornhubUrl(pageUrl) && /youtube|po token|account access/i.test(message)) {
    return 'Pornhub did not expose a direct downloadable media format for this request. Confirm the video is available in the authorized browser session, then use Motrix media capture.';
  }
  return message;
}

export async function resolveSocialMedia(request: SocialResolverRequest): Promise<AddDownloadInput> {
  const runtime = browser.runtime as unknown as NativeMessagingRuntime;
  let result: SocialResolverResponse;
  try {
    result = parseResolverResponse(await runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: 'resolve', ...request }));
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Install the Motrix Social Resolver helper first: ${error.message}`
        : 'Install the Motrix Social Resolver helper first.',
    );
  }
  if (!result.ok || !result.url) {
    throw new Error(result.error || 'The social-media resolver did not return a downloadable format');
  }

  const requestHeaders = Object.entries(result.headers || {})
    .filter(([name, value]) => Boolean(name && value))
    .map(([name, value]) => ({ name, value }));
  return {
    url: result.url,
    filename: buildSocialFilename(result.filename, result.title, result.ext),
    fileSize: typeof result.fileSize === 'number' && result.fileSize > 0 ? result.fileSize : undefined,
    requestHeaders: requestHeaders.length ? requestHeaders : undefined,
    userAgent: request.userAgent,
  };
}

export async function renameLocalFile(path: string, filename: string): Promise<void> {
  const runtime = browser.runtime as unknown as NativeMessagingRuntime;
  let result: SocialResolverResponse;
  try {
    result = parseResolverResponse(await runtime.sendNativeMessage(NATIVE_HOST_NAME, {
      action: 'rename',
      filename,
      path,
    }));
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not rename the downloaded file: ${error.message}`
        : 'Could not rename the downloaded file.',
    );
  }
  if (!result.ok) throw new Error(result.error || 'Could not rename the downloaded file');
}

function parseResolverResponse(value: unknown): SocialResolverResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid social resolver response');
  const result = value as Record<string, unknown>;
  return {
    error: typeof result.error === 'string' ? result.error : undefined,
    ext: typeof result.ext === 'string' ? result.ext : undefined,
    fileSize: typeof result.fileSize === 'number' ? result.fileSize : undefined,
    filename: typeof result.filename === 'string' ? result.filename : undefined,
    headers: result.headers && typeof result.headers === 'object'
      ? Object.fromEntries(Object.entries(result.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined,
    mime: typeof result.mime === 'string' ? result.mime : undefined,
    ok: result.ok === true,
    title: typeof result.title === 'string' ? result.title : undefined,
    url: typeof result.url === 'string' ? result.url : undefined,
  };
}

function buildSocialFilename(filename?: string, title?: string, ext?: string): string {
  const preferred = title && !isGenericFilename(title) ? title : filename || title || 'social-media';
  const normalizedExt = (ext || extractExtension(filename) || 'mp4').replace(/^\./, '').toLowerCase();
  const base = sanitizeFilename(preferred)
    .replace(new RegExp(`\\.${escapeRegExp(normalizedExt)}$`, 'i'), '')
    .replace(/\s*\[[^\]]{4,}\]\s*$/, '')
    .trim();
  return `${base || 'social-media'}.${normalizedExt}`;
}

function sanitizeFilename(value: string): string {
  return Array.from(value.replace(/[\\/:*?"<>|]/g, '_'))
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_FILENAMES = new Set([
  'download',
  'file',
  'media',
  'video',
  'audio',
  'videoplayback',
  'manifest',
  'master',
  'playlist',
]);

function isGenericFilename(value: string): boolean {
  const baseName = value.trim().replace(/\.[a-z0-9]{2,5}$/i, '').toLowerCase();
  return GENERIC_FILENAMES.has(baseName);
}

function extractExtension(value?: string): string | undefined {
  return value?.match(/\.([a-z0-9]{2,5})$/i)?.[1];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
