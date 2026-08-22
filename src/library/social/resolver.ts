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

interface NativeMessagingRuntime {
  sendNativeMessage: (hostName: string, message: SocialResolverRequest) => Promise<unknown>;
}

const NATIVE_HOST_NAME = 'com.motrix.social_resolver';
const SOCIAL_HOSTS = new Set(['facebook.com', 'fb.watch', 'dailymotion.com', 'dai.ly', 'youtube.com', 'youtu.be']);

export function isSocialMediaUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return [...SOCIAL_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export async function resolveSocialMedia(request: SocialResolverRequest): Promise<AddDownloadInput> {
  const runtime = browser.runtime as unknown as NativeMessagingRuntime;
  let result: SocialResolverResponse;
  try {
    result = parseResolverResponse(await runtime.sendNativeMessage(NATIVE_HOST_NAME, request));
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
    filename: result.filename || buildFallbackFilename(result.title, result.ext),
    requestHeaders: requestHeaders.length ? requestHeaders : undefined,
    userAgent: request.userAgent,
  };
}

function parseResolverResponse(value: unknown): SocialResolverResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid social resolver response');
  const result = value as Record<string, unknown>;
  return {
    error: typeof result.error === 'string' ? result.error : undefined,
    ext: typeof result.ext === 'string' ? result.ext : undefined,
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

function buildFallbackFilename(title?: string, ext?: string): string {
  const safeTitle = (title || 'social-media').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  return `${safeTitle || 'social-media'}${ext ? `.${ext.replace(/^\./, '')}` : '.mp4'}`;
}
