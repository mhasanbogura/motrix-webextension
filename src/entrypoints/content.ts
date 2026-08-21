import type { ContextMenuTarget, ContextMenuTargetSource, RuntimeMessage, RuntimeResponse } from '@/library/messages';

const PROTOCOL_PATTERN = /^(?:magnet|ed2k|thunder):/i;
const CONTEXT_MENU_TARGET_TTL_MS = 60000;
const MEDIA_BUTTON_ID = 'motrix-idm-media-capture';
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:', 'magnet:', 'ed2k:', 'thunder:']);
const TEXT_URL_PATTERN = /(https?:\/\/[^\s<>"'`]+|magnet:\?[^\s<>"'`]+|ed2k:\/\/[^\s<>"'`]+|thunder:\/\/[A-Z0-9+/=]+)/i;
const MEDIA_BUTTON_IDLE_MS = 5000;
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
let activeMedia: HTMLImageElement | HTMLMediaElement | undefined;
let mediaButton: HTMLButtonElement | undefined;
let mediaButtonFadeTimer: number | undefined;
let lastPointerPoint: { x: number; y: number } | undefined;

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
    if (!response.ok && response.code === 'disabled') location.href = href;
  }).catch(() => {
    location.href = href;
  });
}

function handleMediaPointerOver(event: PointerEvent): void {
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
  const nextMedia = next instanceof Element ? getClosestMediaElement(next) : undefined;
  if (nextMedia === activeMedia) return;
  scheduleMediaButtonFade();
}

function handlePointerMove(event: PointerEvent): void {
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
  const media = event.target instanceof HTMLMediaElement ? event.target : undefined;
  if (!media || !isSupportedUrl(getMediaUrl(media))) return;
  const pointer = lastPointerPoint;
  const rect = media.getBoundingClientRect();
  if (activeMedia === media || (pointer && isPointInRect(pointer.x, pointer.y, rect))) activateMedia(media);
}

function activateMedia(media: HTMLImageElement | HTMLMediaElement): void {
  if (!isSupportedUrl(getMediaUrl(media))) return;
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
    const url = target ? getMediaUrl(target) : undefined;
    if (!url || !isSupportedUrl(url)) return;
    mediaButton!.disabled = true;
    mediaButton!.textContent = 'Opening picker…';
    void browser.runtime.sendMessage({
      type: 'capture-url',
      url,
      pageUrl: location.href,
      source: getMediaSource(target),
      filename: getFilenameHint(target),
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
  const linkUrl = getClosestLinkUrl(element);
  if (linkUrl) return buildTarget(linkUrl, 'link', getFilenameHint(element));

  const media = getClosestMediaElement(element) ?? getMediaAtPoint(event.clientX, event.clientY);
  const mediaUrl = getMediaUrl(media);
  if (mediaUrl && isSupportedUrl(mediaUrl)) return buildTarget(mediaUrl, getMediaSource(media), getFilenameHint(media));

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

function getMediaFromPointer(event: PointerEvent): HTMLImageElement | HTMLMediaElement | undefined {
  const target = event.target instanceof Element ? event.target : undefined;
  return getClosestMediaElement(target) ?? getMediaAtPoint(event.clientX, event.clientY);
}

function getMediaAtPoint(x: number, y: number): HTMLImageElement | HTMLMediaElement | undefined {
  return document.elementsFromPoint(x, y)
    .map((element) => getClosestMediaElement(element))
    .find((media): media is HTMLImageElement | HTMLMediaElement => Boolean(media));
}

function getMediaUrl(media: HTMLImageElement | HTMLMediaElement | undefined): string | undefined {
  if (!media) return undefined;
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
    media instanceof HTMLImageElement ? media.currentSrc : media.currentSrc,
    media instanceof HTMLImageElement ? media.src : media.src,
    ...sourceCandidates,
    ...attributeCandidates,
  ];
  return candidates
    .map((candidate) => normalizeSupportedUrl(candidate ?? undefined))
    .find((candidate): candidate is string => Boolean(candidate));
}

function getMediaSource(media: HTMLImageElement | HTMLMediaElement | undefined): ContextMenuTargetSource {
  return media instanceof HTMLImageElement ? 'media' : 'media';
}

function buildTarget(url: string, source: ContextMenuTargetSource, filename?: string): ContextMenuTarget {
  return { url, pageUrl: location.href, source, filename };
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
