import type { DownloadCaptureType } from '@/library/storage';
import type { ContextMenuTarget, ContextMenuTargetSource, RuntimeMessage, RuntimeResponse } from '@/library/messages';

import { isSocialMediaUrl } from '@/library/social/resolver';

const PROTOCOL_PATTERN = /^(?:magnet|ed2k|thunder):/i;
const CONTEXT_MENU_TARGET_TTL_MS = 60000;
const MEDIA_BUTTON_ID = 'motrix-idm-media-capture';
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:', 'magnet:', 'ed2k:', 'thunder:']);
const TEXT_URL_PATTERN = /(https?:\/\/[^\s<>"'`]+|magnet:\?[^\s<>"'`]+|ed2k:\/\/[^\s<>"'`]+|thunder:\/\/[A-Z0-9+/=]+)/i;
const MEDIA_BUTTON_IDLE_MS = 5000;
const MEDIA_RESOURCE_EXTENSIONS = /\.(?:m3u8|mpd|mp4|m4v|webm|m4s|ts)(?:$|[?#])/i;
const MEDIA_NON_VIDEO_EXTENSIONS = /\.(?:html?|php|js|css|json|jpg|jpeg|png|gif|svg|avif|webp)(?:$|[?#])/i;
const MEDIA_THUMBNAIL_PATHS = /\/(?:pics\/gifs|thumbs?|thumbnails?|posters?|previews?|images?)\//i;
const MEDIA_PREVIEW_TRANSFORMS = /\/(?:plain|rs:fit|rs:fill|vts)(?:\/|$)/i;
const MEDIA_SEGMENT_RESOURCES = /(?:^|[/_-])(?:seg|segment|chunk|fragment)[-_/]/i;
const MEDIA_RESOURCE_HOSTS = new RegExp(
  ['googlevideo\\.com', 'fbcdn\\.net', 'dailymotion\\.com', 'dmcdn\\.net', 'akamaized\\.net', 'cloudfront\\.net',
    'luluvid\\.com', 'lulustream\\.com', 'phncdn\\.com'].join('|'),
  'i',
);
const MEDIA_RESOURCE_HINTS = new RegExp(
  ['videoplayback', 'manifest', 'master', 'playlist', 'segment', 'stream', 'media', 'video', 'clip', 'download',
    'quality', 'resolution', 'height', '\\.m3u8', '\\.mpd', 'mime=video', 'mime=audio'].join('|'),
  'i',
);
const MEDIA_PLAYER_SELECTORS = '[id^="playerDiv_"], [data-player], .mgp, .video-player, .jwplayer';
const MEDIA_URL_ATTRIBUTES = [
  'src',
  'data-src',
  'data-url',
  'data-video',
  'data-video-url',
  'data-file',
  'data-download',
  'data-href',
  'data-original',
  'data-source',
  'data-stream-url',
] as const;

interface RecordedContextMenuTarget {
  time: number;
  target: ContextMenuTarget;
}

let lastContextMenuTarget: RecordedContextMenuTarget | undefined;
type CaptureTarget = HTMLImageElement | HTMLMediaElement | HTMLElement;

let activeMedia: CaptureTarget | undefined;
let mediaButton: HTMLButtonElement | undefined;
let mediaButtonFadeTimer: number | undefined;
let lastPointerPoint: { x: number; y: number } | undefined;
let pageBlocked = true;
let captureTypes: Record<DownloadCaptureType, boolean> = {
  audio: false,
  video: false,
  image: false,
  document: false,
  archive: false,
  other: false,
};

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('click', handleProtocolClick, true);
    document.addEventListener('pointerover', handleMediaPointerOver, true);
    document.addEventListener('pointerout', handleMediaPointerOut, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('loadedmetadata', handleMediaSourceReady, true);
    document.addEventListener('loadeddata', handleMediaSourceReady, true);
    document.addEventListener('canplay', handleMediaSourceReady, true);
    browser.storage.onChanged.addListener(handleStorageChanged);
    void refreshCaptureStatus();
    window.addEventListener('scroll', repositionMediaButton, { passive: true });
    window.addEventListener('resize', repositionMediaButton, { passive: true });

    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      if (message.type !== 'resolve-context-menu-target') return undefined;
      return Promise.resolve<RuntimeResponse>({
        ok: true,
        contextMenuTarget: getLatestContextMenuTarget(),
      });
    });
  },
});

function handleStorageChanged(changes: Record<string, Browser.storage.StorageChange>, areaName: string): void {
  if (areaName !== 'local' || !changes.motrixExtension) return;
  void refreshCaptureStatus();
}

async function refreshCaptureStatus(): Promise<void> {
  pageBlocked = true;
  removeMediaButton();
  try {
    const response = await browser.runtime.sendMessage({
      type: 'capture-site-status',
      url: location.href,
      pageUrl: location.href,
    } satisfies RuntimeMessage) as RuntimeResponse;
    const result = response.ok && typeof response.result === 'object' && response.result !== null
      ? response.result as { blocked?: unknown; captureTypes?: Partial<Record<DownloadCaptureType, unknown>> }
      : undefined;
    pageBlocked = result?.blocked === true;
    captureTypes = {
      audio: result?.captureTypes?.audio === true,
      video: result?.captureTypes?.video === true,
      image: result?.captureTypes?.image === true,
      document: result?.captureTypes?.document === true,
      archive: result?.captureTypes?.archive === true,
      other: result?.captureTypes?.other === true,
    };
  } catch {
    pageBlocked = true;
  }
}

function handleContextMenu(event: MouseEvent): void {
  lastContextMenuTarget = {
    time: Date.now(),
    target: resolveContextMenuTarget(event),
  };
}

function handleProtocolClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(target instanceof HTMLAnchorElement)) return;
  const href = normalizeSupportedUrl(target.href);
  if (!href || !PROTOCOL_PATTERN.test(href)) return;

  event.preventDefault();
  event.stopPropagation();
  void browser.runtime.sendMessage({
    type: 'content-protocol-click',
    url: href,
    pageUrl: location.href,
    filename: getFilenameHint(target),
  }).then((response: RuntimeResponse) => {
    if (!response.ok && (response.code === 'disabled' || response.code === 'site_rule_blocked')) location.href = href;
  }).catch(() => {
    location.href = href;
  });
}

function handleMediaPointerOver(event: PointerEvent): void {
  if (pageBlocked) return;
  lastPointerPoint = { x: event.clientX, y: event.clientY };
  const media = getMediaFromPointer(event);
  if (!media) return;
  activateMedia(media);
}

function handleMediaPointerOut(event: PointerEvent): void {
  if (!activeMedia) return;
  const next = event.relatedTarget instanceof Node ? event.relatedTarget : undefined;
  if (next && activeMedia.contains(next)) return;
  if (next && mediaButton?.contains(next)) return;
  const nextMedia = next instanceof Element ? getClosestCaptureTarget(next) : undefined;
  if (nextMedia === activeMedia) return;
  scheduleMediaButtonFade();
}

function handlePointerMove(event: PointerEvent): void {
  if (pageBlocked) return;
  lastPointerPoint = { x: event.clientX, y: event.clientY };
  if (!activeMedia) {
    const media = getMediaFromPointer(event);
    if (media) activateMedia(media);
  }
  if (!activeMedia || !mediaButton) return;
  const mediaRect = activeMedia.getBoundingClientRect();
  const buttonRect = mediaButton.getBoundingClientRect();
  const inMedia = isPointInRect(event.clientX, event.clientY, mediaRect);
  const inButton = isPointInRect(event.clientX, event.clientY, buttonRect);
  if (!inMedia && !inButton) return;
  revealMediaButton();
  scheduleMediaButtonFade();
}

function handleMediaSourceReady(event: Event): void {
  if (pageBlocked) return;
  const media = event.target instanceof HTMLMediaElement ? event.target : undefined;
  if (!media || !isSupportedUrl(getMediaDownloadUrl(media))) return;
  const pointer = lastPointerPoint;
  const rect = media.getBoundingClientRect();
  if (activeMedia === media || (pointer && isPointInRect(pointer.x, pointer.y, rect))) activateMedia(media);
}

function activateMedia(media: CaptureTarget): void {
  if (pageBlocked || !captureTypes[getMediaCaptureType(media)] || !isSupportedUrl(getMediaDownloadUrl(media))) return;
  activeMedia = media;
  ensureMediaButton();
  repositionMediaButton();
  revealMediaButton();
  scheduleMediaButtonFade();
}

function ensureMediaButton(): void {
  if (mediaButton) return;
  mediaButton = document.createElement('button');
  mediaButton.id = MEDIA_BUTTON_ID;
  mediaButton.type = 'button';
  mediaButton.textContent = 'Download with Motrix';
  mediaButton.setAttribute('aria-label', 'Download media with Motrix');
  Object.assign(mediaButton.style, {
    position: 'fixed',
    zIndex: '2147483647',
    display: 'block',
    border: '0',
    borderRadius: '8px',
    padding: '9px 12px',
    background: '#7561d9',
    color: '#fff',
    boxShadow: '0 6px 18px rgba(37, 28, 97, .32)',
    font: '700 12px system-ui, sans-serif',
    cursor: 'pointer',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 180ms ease',
  });
  mediaButton.addEventListener('pointerdown', (event) => event.stopPropagation());
  mediaButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = activeMedia;
    const urls = target ? getMediaDownloadUrls(target) : [];
    const url = urls[0];
    if (!url || !isSupportedUrl(url)) return;
    const mediaCandidates = target ? getMediaCandidateMetadata(target, urls) : [];

    mediaButton!.disabled = true;
    mediaButton!.textContent = 'Opening picker…';
    void browser.runtime.sendMessage({
      type: 'capture-url',
      url,
      urls: urls.length > 1 ? urls : undefined,
      mediaCandidates: mediaCandidates.length > 1 ? mediaCandidates : undefined,
      pageUrl: location.href,
      source: getMediaSource(target),
      filename: getFilenameHint(target),
      fileSize: mediaCandidates[0]?.fileSize ?? getMediaFileSize(target, urls),
      captureType: getMediaCaptureType(target),
    }).then((response: RuntimeResponse) => {
      if (!response.ok) {
        mediaButton!.disabled = false;
        mediaButton!.textContent = response.message || 'Retry with Motrix';
        return;
      }
      removeMediaButton();
    }).catch(() => removeMediaButton());
  });
  document.documentElement.appendChild(mediaButton);
}

function revealMediaButton(): void {
  if (!mediaButton) return;
  mediaButton.style.opacity = '1';
  mediaButton.style.pointerEvents = 'auto';
}

function scheduleMediaButtonFade(): void {
  if (mediaButtonFadeTimer !== undefined) window.clearTimeout(mediaButtonFadeTimer);
  mediaButtonFadeTimer = window.setTimeout(() => {
    if (!mediaButton) return;
    mediaButton.style.opacity = '0';
    mediaButton.style.pointerEvents = 'none';
    mediaButtonFadeTimer = undefined;
  }, MEDIA_BUTTON_IDLE_MS);
}

function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function repositionMediaButton(): void {
  if (!mediaButton || !activeMedia) return;
  const rect = activeMedia.getBoundingClientRect();
  const width = mediaButton.offsetWidth || 180;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width - 8));
  const top = Math.max(8, Math.min(window.innerHeight - 46, rect.top + 8));
  mediaButton.style.left = `${left}px`;
  mediaButton.style.top = `${top}px`;
}

function removeMediaButton(): void {
  if (mediaButtonFadeTimer !== undefined) window.clearTimeout(mediaButtonFadeTimer);
  mediaButtonFadeTimer = undefined;
  mediaButton?.remove();
  mediaButton = undefined;
  activeMedia = undefined;
  lastPointerPoint = undefined;
}

function resolveContextMenuTarget(event: MouseEvent): ContextMenuTarget {
  const element = getElementAtPoint(event);
  const media = getClosestCaptureTarget(element) ?? getMediaAtPoint(event.clientX, event.clientY);
  const mediaUrls = getMediaDownloadUrls(media);
  const mediaUrl = mediaUrls[0];
  if (mediaUrl && isSupportedUrl(mediaUrl)) {
    return buildTarget(
      mediaUrl,
      getMediaSource(media),
      getFilenameHint(media),
      getMediaCaptureType(media),
      mediaUrls,
      getMediaFileSize(media, mediaUrls),
      getMediaCandidateMetadata(media, mediaUrls),
    );
  }

  const linkUrl = getClosestLinkUrl(element);
  if (linkUrl) return buildTarget(linkUrl, 'link', getFilenameHint(element));

  const selectionUrl = findSupportedTextUrl(globalThis.getSelection()?.toString());
  if (selectionUrl) return buildTarget(selectionUrl, 'selection');

  return buildTarget(location.href, 'page');
}

function getLatestContextMenuTarget(): ContextMenuTarget {
  const recorded = lastContextMenuTarget;
  const isFresh = recorded
    && recorded.target.pageUrl === location.href
    && Date.now() - recorded.time <= CONTEXT_MENU_TARGET_TTL_MS;
  return isFresh ? recorded.target : buildTarget(location.href, 'page');
}

function getElementAtPoint(event: MouseEvent): Element | undefined {
  const pointElement = document.elementFromPoint(event.clientX, event.clientY);
  if (pointElement instanceof Element) return pointElement;
  return event.target instanceof Element ? event.target : undefined;
}

function getClosestLinkUrl(element: Element | undefined): string | undefined {
  const link = element?.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return undefined;
  return normalizeSupportedUrl(link.href);
}

function getFilenameHint(element: Element | undefined): string | undefined {
  const link = element?.closest('a[href]');
  const metadataElement = element?.closest('[data-filename], [data-file-name], [data-name], [data-title]');
  const candidates = [
    link?.getAttribute('download'),
    element?.getAttribute('data-filename'),
    element?.getAttribute('data-file-name'),
    element?.getAttribute('data-name'),
    element?.getAttribute('data-title'),
    metadataElement?.getAttribute('data-filename'),
    metadataElement?.getAttribute('data-file-name'),
    metadataElement?.getAttribute('data-name'),
    metadataElement?.getAttribute('data-title'),
    element?.getAttribute('title'),
    element?.getAttribute('aria-label'),
  ];
  return candidates.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}

function getClosestMediaElement(element: Element | undefined): HTMLImageElement | HTMLMediaElement | undefined {
  const image = element?.closest('img');
  if (image instanceof HTMLImageElement) return image;
  const media = element?.closest('video,audio');
  if (media instanceof HTMLMediaElement) return media;
  return undefined;
}

function getClosestPlayerContainer(element: Element | undefined): HTMLElement | undefined {
  const player = element?.closest(MEDIA_PLAYER_SELECTORS);
  return player instanceof HTMLElement ? player : undefined;
}

function getClosestCaptureTarget(element: Element | undefined): CaptureTarget | undefined {
  return getClosestMediaElement(element) ?? getClosestPlayerContainer(element);
}

function getMediaFromPointer(event: PointerEvent): CaptureTarget | undefined {
  const target = event.target instanceof Element ? event.target : undefined;
  return getClosestCaptureTarget(target) ?? getMediaAtPoint(event.clientX, event.clientY);
}

function getMediaAtPoint(x: number, y: number): CaptureTarget | undefined {
  const fromLayers = document.elementsFromPoint(x, y)
    .map((element) => getClosestCaptureTarget(element))
    .find((media): media is CaptureTarget => Boolean(media));
  if (fromLayers) return fromLayers;
  return Array.from(document.querySelectorAll(`video, audio, img, ${MEDIA_PLAYER_SELECTORS}`))
    .map((element) => getClosestCaptureTarget(element))
    .find((media): media is CaptureTarget => {
      if (!media) return false;
      return isPointInRect(x, y, media.getBoundingClientRect());
    });
}

function getMediaDownloadUrl(media: CaptureTarget | undefined): string | undefined {
  return getMediaDownloadUrls(media)[0];
}

function getMediaDownloadUrls(media: CaptureTarget | undefined): string[] {
  if (!media) return [];
  const directMediaUrls = getMediaUrls(media).filter(isLikelyMediaResource);
  const runtimeMediaUrls = media instanceof HTMLMediaElement || isPlayerContainer(media)
    ? getRecentMediaResourceUrls()
    : [];
  const candidates = [...directMediaUrls, ...runtimeMediaUrls]
    .filter((url, index, values) => values.indexOf(url) === index)
    .sort((left, right) => mediaResourceScore(right) - mediaResourceScore(left));
  if (candidates.length) return candidates;
  if ((media instanceof HTMLMediaElement || isPlayerContainer(media)) && isSocialMediaUrl(location.href)) {
    return [location.href];
  }
  return [];
}

function getRecentMediaResourceUrls(): string[] {
  const now = performance.now();
  const resourceCandidates = performance.getEntriesByType('resource')
    .map((entry) => entry as PerformanceResourceTiming)
    .filter((entry) => now - entry.startTime < 120000)
    .map((entry) => normalizeSupportedUrl(entry.name))
    .filter((url): url is string => Boolean(url))
    .filter(isLikelyMediaResource);
  const embeddedCandidates = getEmbeddedMediaResourceUrls();
  return [...resourceCandidates, ...embeddedCandidates]
    .filter((url, index, values) => values.indexOf(url) === index)
    .sort((left, right) => mediaResourceScore(right) - mediaResourceScore(left));
}

function getEmbeddedMediaResourceUrls(): string[] {
  const urls = new Set<string>();
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent;
    if (!text || text.length > 2_000_000) continue;
    const matches = text.match(/https?:[^"' \t\r\n]+/g) || [];
    for (const match of matches) {
      const url = normalizeSupportedUrl(decodeEmbeddedUrl(match));
      if (url && isLikelyMediaResource(url)) urls.add(url);
    }
  }
  return [...urls];
}

function decodeEmbeddedUrl(value: string): string {
  return value
    .replaceAll('\\/', '/')
    .replaceAll('\\u0026', '&')
    .replaceAll('\\u003d', '=')
    .replaceAll('\\u00253A', ':');
}

function isLikelyMediaResource(url: string): boolean {
  if (!isSupportedUrl(url) || (isKnownVideoPageUrl(url) && !isPornhubDirectMediaUrl(url))) return false;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const isPhnCdn = /(?:^|\.)phncdn\.com$/i.test(parsed.hostname);
    if (MEDIA_NON_VIDEO_EXTENSIONS.test(pathname)) return false;
    if (/\.(?:m4s|ts)(?:$|[?#])/i.test(pathname) || MEDIA_SEGMENT_RESOURCES.test(pathname)) return false;
    if (isPhnCdn && (MEDIA_THUMBNAIL_PATHS.test(pathname) || MEDIA_PREVIEW_TRANSFORMS.test(pathname))) return false;
  } catch {
    return false;
  }
  return MEDIA_RESOURCE_EXTENSIONS.test(url)
    || isPornhubDirectMediaUrl(url)
    || (MEDIA_RESOURCE_HOSTS.test(url) && MEDIA_RESOURCE_HINTS.test(url));
}

function isKnownVideoPageUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?pornhub\.com\/(?:view_video\.php|video\/(?!get_media(?:[/?]|$)))/i.test(url);
}

function isPornhubDirectMediaUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?pornhub\.com\/video\/get_media(?:[/?]|$)/i.test(url);
}

function mediaResourceScore(url: string): number {
  let score = 50;
  if (isPornhubDirectMediaUrl(url)) score += 220;
  if (/\.(?:m3u8|mpd)(?:$|[?#])/i.test(url)) score += 140;
  if (/\.(?:mp4|m4v|webm)(?:$|[?#])/i.test(url)) score += 90;
  if (MEDIA_RESOURCE_HOSTS.test(url)) score += 25;
  if (MEDIA_RESOURCE_HINTS.test(url)) score += 35;
  if (/\.(?:m4s|ts)(?:$|[?#])/i.test(url) || MEDIA_SEGMENT_RESOURCES.test(url)) score -= 300;
  if (MEDIA_PREVIEW_TRANSFORMS.test(url)) score -= 120;
  return score;
}

function getMediaUrls(media: CaptureTarget | undefined): string[] {
  if (!media) return [];
  const attributeCandidates = MEDIA_URL_ATTRIBUTES.flatMap((attribute) => [
    media.getAttribute(attribute),
    media.dataset[attribute.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())],
  ]);
  const sourceCandidates = media instanceof HTMLMediaElement
    ? Array.from(media.querySelectorAll('source')).flatMap((source) => [
        source.src,
        ...MEDIA_URL_ATTRIBUTES.map((attribute) => source.getAttribute(attribute)),
      ])
    : [];
  const candidates = [
    media instanceof HTMLMediaElement || media instanceof HTMLImageElement ? media.currentSrc : undefined,
    media instanceof HTMLMediaElement || media instanceof HTMLImageElement ? media.src : undefined,
    ...sourceCandidates,
    ...attributeCandidates,
  ];
  return candidates
    .map((candidate) => normalizeSupportedUrl(candidate ?? undefined))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate, index, values) => values.indexOf(candidate) === index);
}

function getMediaCandidateMetadata(
  media: CaptureTarget | undefined,
  urls: string[],
): Array<{ url: string; fileSize?: number }> {
  return urls.map((url) => ({ url, fileSize: getMediaFileSize(media, [url]) }));
}

function getMediaFileSize(media: CaptureTarget | undefined, urls: string[]): number | undefined {
  if (!media) return undefined;
  const sizeHint = [
    media.getAttribute('data-size'),
    media.getAttribute('data-file-size'),
    media.getAttribute('data-filesize'),
    media.getAttribute('data-content-length'),
  ].map(parseSizeHint).find((value): value is number => typeof value === 'number');
  if (sizeHint) return sizeHint;
  if (urls.some((url) => /\.(?:m3u8|mpd)(?:$|[?#])/i.test(url))) return undefined;
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const matchingResource = resources.find((entry) => urls.includes(normalizeSupportedUrl(entry.name) || ''));
  const size = matchingResource?.encodedBodySize || matchingResource?.decodedBodySize;
  return size && size > 0 ? size : undefined;
}

function parseSizeHint(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\\d+(?:\\.\\d+)?)\\s*(b|kb|mb|gb)?$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  const multiplier = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Number.isFinite(amount) ? Math.round(amount * multiplier) : undefined;
}

function getMediaSource(media: CaptureTarget | undefined): ContextMenuTargetSource {
  return media instanceof HTMLImageElement ? 'media' : 'media';
}

function getMediaCaptureType(media: CaptureTarget | undefined): DownloadCaptureType {
  if (media instanceof HTMLVideoElement || isPlayerContainer(media)) return 'video';
  if (media instanceof HTMLAudioElement) return 'audio';
  if (media instanceof HTMLImageElement) return 'image';
  return 'other';
}

function isPlayerContainer(media: CaptureTarget | undefined): boolean {
  return media instanceof HTMLElement && media.matches(MEDIA_PLAYER_SELECTORS);
}

function buildTarget(
  url: string,
  source: ContextMenuTargetSource,
  filename?: string,
  captureType?: DownloadCaptureType,
  urls?: string[],
  fileSize?: number,
  mediaCandidates?: Array<{ url: string; fileSize?: number }>,
): ContextMenuTarget {
  return {
    url,
    urls: urls?.length && urls.length > 1 ? urls : undefined,
    mediaCandidates: mediaCandidates?.length && mediaCandidates.length > 1 ? mediaCandidates : undefined,
    pageUrl: location.href,
    source,
    filename,
    fileSize,
    captureType,
  };
}

function findSupportedTextUrl(text: string | undefined): string | undefined {
  const match = text?.match(TEXT_URL_PATTERN)?.[0];
  return normalizeSupportedUrl(match);
}

function normalizeSupportedUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^[<('“‘]+/, '').replace(/[>)',.，。；;!！?？]+$/, '');
  if (!trimmed) return undefined;
  try {
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : new URL(trimmed, location.href).href;
    return isSupportedUrl(absolute) ? absolute : undefined;
  } catch {
    return undefined;
  }
}

function isSupportedUrl(value: string | undefined): value is string {
  if (!value) return false;
  return SUPPORTED_PROTOCOLS.has(getProtocol(value));
}

function getProtocol(value: string): string {
  try {
    return new URL(value).protocol;
  } catch {
    return /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase().concat(':') ?? '';
  }
}
