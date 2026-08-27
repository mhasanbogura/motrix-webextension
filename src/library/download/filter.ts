import type { DownloadCaptureType, DownloadSettings, SiteRule } from '@/library/storage';

export interface DownloadCandidate {
  url: string;
  mime?: string;
  tabUrl?: string;
  filename?: string;
  fileSize?: number;
  finalUrl?: string;
  totalBytes?: number;
  byExtensionId?: string;
}

export interface FilterResult {
  reason: string;
  intercept: boolean;
}

const AUDIO_EXTENSIONS = new Set(['aac', 'aiff', 'flac', 'm4a', 'mka', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'weba', 'wma']);
const VIDEO_EXTENSIONS = new Set(['avi', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'ogv', 'ts', 'webm', 'wmv']);
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp']);
const DOCUMENT_EXTENSIONS = new Set(['csv', 'doc', 'docx', 'epub', 'html', 'md', 'pdf', 'ppt', 'pptx', 'rtf', 'txt', 'xls', 'xlsx', 'xml']);
const ARCHIVE_EXTENSIONS = new Set(['7z', 'bz', 'bz2', 'cab', 'gz', 'iso', 'rar', 'tar', 'xz', 'zip', 'zst']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/epub+zip',
  'application/msword',
  'application/pdf',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/xml',
]);
const ARCHIVE_MIME_TYPES = new Set([
  'application/gzip',
  'application/java-archive',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-bzip2',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/x-xz',
  'application/zip',
]);

export function shouldInterceptDownload(
  candidate: DownloadCandidate,
  settings: DownloadSettings,
  siteRules: SiteRule[],
  extensionId: string,
): FilterResult {
  if (!settings.enabled) return { intercept: false, reason: 'disabled' };
  if (candidate.byExtensionId === extensionId) return { intercept: false, reason: 'self_download' };

  const url = candidate.finalUrl || candidate.url;
  const protocol = getProtocol(url);
  if (!['http:', 'https:', 'magnet:', 'ed2k:', 'thunder:'].includes(protocol)) {
    return { intercept: false, reason: 'unsupported_protocol' };
  }
  if ((protocol === 'http:' || protocol === 'https:') && !settings.interceptHttp) {
    return { intercept: false, reason: 'http_disabled' };
  }
  if (protocol === 'magnet:' && !settings.interceptMagnet) return { intercept: false, reason: 'magnet_disabled' };
  if (protocol === 'ed2k:' && !settings.interceptEd2k) return { intercept: false, reason: 'ed2k_disabled' };
  if (protocol === 'thunder:' && !settings.interceptThunder) return { intercept: false, reason: 'thunder_disabled' };

  const size = candidate.totalBytes && candidate.totalBytes > 0 ? candidate.totalBytes : candidate.fileSize ?? 0;
  if (settings.minFileSizeBytes > 0 && size > 0 && size < settings.minFileSizeBytes) {
    return { intercept: false, reason: 'small_file' };
  }

  const blockedSite = matchBlockedSite(url, candidate.tabUrl, siteRules, settings.blockedExtensions);
  if (blockedSite) return { intercept: false, reason: 'site_rule_blocked' };
  const captureType = getDownloadCaptureType(candidate);
  if (!settings.captureTypes[captureType]) return { intercept: false, reason: `${captureType}_disabled` };

  const extension = getExtension(candidate.filename || url);
  const allowedExtensions = normalizeExtensions(settings.allowedExtensions);
  const blockedExtensions = normalizeExtensions(settings.blockedExtensions);
  if (allowedExtensions.length > 0 && extension && !allowedExtensions.includes(extension)) {
    return { intercept: false, reason: 'extension_not_allowed' };
  }
  if (extension && blockedExtensions.includes(extension)) {
    return { intercept: false, reason: 'extension_blocked' };
  }

  const matchedRule = siteRules.find(
    (rule) => rule.enabled && (globMatch(rule.pattern, url) || globMatch(rule.pattern, candidate.tabUrl || '')),
  );
  return { intercept: true, reason: matchedRule?.action === 'allow' ? 'site_rule_allowed' : 'matched' };
}

export function isCaptureTypeEnabled(
  candidate: Pick<DownloadCandidate, 'url' | 'filename' | 'mime'>,
  settings: DownloadSettings,
): boolean {
  return settings.captureTypes[getDownloadCaptureType(candidate)];
}

export function getDownloadCaptureType(
  candidate: Pick<DownloadCandidate, 'url' | 'filename' | 'mime'>,
): DownloadCaptureType {
  const extension = getExtension(candidate.filename || candidate.url);
  const mime = candidate.mime?.split(';')[0]?.trim().toLowerCase() || '';
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (ARCHIVE_MIME_TYPES.has(mime) || ARCHIVE_EXTENSIONS.has(extension)) return 'archive';
  if (DOCUMENT_MIME_TYPES.has(mime) || DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'other';
}

export function isUrlBlocked(
  url: string,
  pageUrl: string | undefined,
  settings: DownloadSettings,
  siteRules: SiteRule[],
): boolean {
  return Boolean(matchBlockedSite(url, pageUrl, siteRules, settings.blockedExtensions));
}

export function isPickerEnabled(pageUrl: string | undefined, pickerRules: Record<string, boolean>): boolean {
  if (!pageUrl) return true;
  return !Object.entries(pickerRules).some(([pattern, enabled]) => enabled === false && globMatch(pattern, pageUrl));
}

export function isProtocolEnabled(url: string, settings: DownloadSettings): boolean {
  const protocol = getProtocol(url);
  if (!['http:', 'https:', 'magnet:', 'ed2k:', 'thunder:'].includes(protocol)) return false;
  if (protocol === 'magnet:') return settings.enabled && settings.interceptMagnet;
  if (protocol === 'ed2k:') return settings.enabled && settings.interceptEd2k;
  if (protocol === 'thunder:') return settings.enabled && settings.interceptThunder;
  return settings.enabled && settings.interceptHttp;
}

function getProtocol(url: string): string {
  try {
    return new URL(url).protocol;
  } catch {
    return /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase().concat(':') ?? '';
  }
}

function getExtension(value: string): string {
  const clean = value.split('?')[0]?.split('#')[0] ?? value;
  const match = /\.([a-z0-9]{1,12})$/i.exec(clean);
  return match?.[1]?.toLowerCase() ?? '';
}

function normalizeExtensions(extensions: string[]): string[] {
  return extensions
    .map((extension) => extension.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
}

function matchBlockedSite(
  url: string,
  pageUrl: string | undefined,
  siteRules: SiteRule[],
  blockedExtensions: string[],
): boolean {
  const matchedRule = siteRules.find(
    (rule) => rule.enabled && (rule.action === 'block')
      && (globMatch(rule.pattern, url) || globMatch(rule.pattern, pageUrl || '')),
  );
  if (matchedRule) return true;
  return blockedExtensions
    .map((pattern) => pattern.trim())
    .filter(isUrlPattern)
    .some((pattern) => globMatch(pattern, url) || globMatch(pattern, pageUrl || ''));
}

function isUrlPattern(value: string): boolean {
  return /^(?:https?|file|ftp):\/\//i.test(value) || value.includes('*') || value.includes('://');
}

export function globMatch(pattern: string, value: string): boolean {
  if (!pattern || !value) return false;
  const normalizedPattern = normalizeGlobPattern(pattern);
  const escaped = normalizedPattern
    .replaceAll('*.', '\u0000')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*')
    .replaceAll('?', '.')
    .replaceAll('\u0000', '(?:.*\\.)?');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

function normalizeGlobPattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (trimmed.startsWith('://.')) return `*://*${trimmed.slice(3)}`;
  if (trimmed.startsWith('*://.')) return `*://*${trimmed.slice(4)}`;
  return trimmed;
}
