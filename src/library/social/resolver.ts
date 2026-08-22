import type { AddDownloadInput } from '@/library/rpc';

export interface SocialResolverRequest {
  url: string;
  cookie?: string;
  userAgent?: string;
}

export interface SocialResolverResponse {
  ok: boolean;
  ext?: string;
  url?: string;
  mime?: string;
  error?: string;
  title?: string;
  filename?: string;
  headers?: Record<string, string>;
}

const DEFAULT_RESOLVER_URL = 'http://127.0.0.1:8199';
const SOCIAL_HOSTS = new Set(['facebook.com', 'fb.watch', 'dailymotion.com', 'dai.ly', 'youtube.com', 'youtu.be']);

export function isSocialMediaUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return [...SOCIAL_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function resolveSocialMedia(
  request: SocialResolverRequest,
  resolverUrl?: string,
): Promise<AddDownloadInput> {
  const endpoint = `${(resolverUrl || DEFAULT_RESOLVER_URL).replace(/\/+$/, '')}/v1/resolve`;
  const result = typeof XMLHttpRequest !== 'undefined'
    ? await resolveWithXmlHttpRequest(endpoint, request)
    : await resolveWithFetch(endpoint, request);
  if (!result.ok || !result.url) {
    throw new Error(result.error || 'The social-media resolver did not return a downloadable format');
  }

  const requestHeaders = Object.entries(result.headers || {})
    .filter(([name, value]) => Boolean(name && value))
    .map(([name, value]) => ({ name, value }));
  return {
    url: result.url,
    filename: result.filename || buildFallbackFilename(result.title, result.ext),
    requestHeaders: requestHeaders.length ? requestHeaders : undefined,
    userAgent: request.userAgent,
  };
}

async function resolveWithFetch(endpoint: string, request: SocialResolverRequest): Promise<SocialResolverResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Social resolver HTTP ${response.status}`);
  return parseResolverResponse(await response.json());
}

function resolveWithXmlHttpRequest(endpoint: string, request: SocialResolverRequest): Promise<SocialResolverResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.timeout = 30000;
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Social resolver HTTP ${xhr.status}`));
        return;
      }
      try {
        resolve(parseResolverResponse(JSON.parse(xhr.responseText) as unknown));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error('Could not connect to the local social-media resolver'));
    xhr.ontimeout = () => reject(new Error('The social-media resolver timed out'));
    try {
      xhr.send(JSON.stringify(request));
    } catch (error) {
      reject(error);
    }
  });
}

function parseResolverResponse(value: unknown): SocialResolverResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid social resolver response');
  const result = value as Record<string, unknown>;
  return {
    ok: result.ok === true,
    title: typeof result.title === 'string' ? result.title : undefined,
    url: typeof result.url === 'string' ? result.url : undefined,
    filename: typeof result.filename === 'string' ? result.filename : undefined,
    ext: typeof result.ext === 'string' ? result.ext : undefined,
    mime: typeof result.mime === 'string' ? result.mime : undefined,
    headers: result.headers && typeof result.headers === 'object'
      ? Object.fromEntries(Object.entries(result.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined,
    error: typeof result.error === 'string' ? result.error : undefined,
  };
}

function buildFallbackFilename(title?: string, ext?: string): string {
  const safeTitle = (title || 'social-media').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  return `${safeTitle || 'social-media'}${ext ? `.${ext.replace(/^\./, '')}` : '.mp4'}`;
}
