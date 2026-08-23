import type { AddDownloadInput } from '@/library/rpc';
import type { RuntimeResponse } from '@/library/messages';
import type { DownloadCaptureType } from '@/library/storage';

import { loadSnapshot } from '@/library/storage';
import { filenameFromUrl } from '@/library/download/filename-metadata';
import { isSocialMediaUrl, resolveSocialMedia } from '@/library/social/resolver';
import { getDownloadCaptureType, isProtocolEnabled, isUrlBlocked } from '@/library/download/filter';

import { getCookieHeader } from '../cookies';
import { duplicateGuard } from '../downloads/state';
import { openDownloadPicker } from '../downloads/picker';
import { routeDownloadInput } from '../downloads/route-download-input';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isPageDocumentUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return /\.(?:html?|php)$/i.test(parsed.pathname)
      || /^\/view_video\.php(?:\/|$)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function selectDownloadUrl(url: string, candidates: string[]): string {
  if (isSocialMediaUrl(url)) return url;
  return candidates.find((candidate) => !isPageDocumentUrl(candidate)) || url;
}

export async function routeUrl(
  url: string,
  pageUrl: string,
  source: string,
  filename?: string,
  captureType?: DownloadCaptureType,
  candidateUrls?: string[],
  fileSize?: number,
): Promise<RuntimeResponse> {
  const snapshot = await loadSnapshot();
  const mediaCandidates = [url, ...(candidateUrls || [])]
    .filter((candidate, index, values) => isHttpUrl(candidate) && values.indexOf(candidate) === index);
  const routedUrl = selectDownloadUrl(url, mediaCandidates);
  const pickerCandidates = mediaCandidates.filter(
    (candidate) => !isPageDocumentUrl(candidate) || candidate === routedUrl,
  );
  if (!isProtocolEnabled(routedUrl, snapshot.settings)) {
    return { ok: false, code: 'disabled', message: 'This protocol is disabled' };
  }
  if (isUrlBlocked(routedUrl, pageUrl, snapshot.settings, snapshot.siteRules)) {
    return { ok: false, code: 'site_rule_blocked', message: 'Downloads are blocked for this site' };
  }
  if (captureType && !snapshot.settings.captureTypes[captureType]) {
    return { ok: false, code: 'capture_type_disabled', message: `${captureType} capture is disabled` };
  }
  if (!duplicateGuard.reserve([routedUrl, pageUrl])) {
    return { ok: true, result: 'duplicate-blocked' };
  }
  const cookie = snapshot.settings.forwardCookies ? await getCookieHeader(routedUrl) : undefined;
  let input: AddDownloadInput;
  if (isSocialMediaUrl(url)) {
    try {
      input = await resolveSocialMedia({ url, cookie });
    } catch (error) {
      return {
        ok: false,
        code: 'social_resolver_unavailable',
        message: error instanceof Error ? error.message : String(error),
      };
    }
    input = {
      ...input,
      referer: pageUrl,
      cookie,
      finalUrl: url,
      filename: isSocialMediaUrl(url) ? input.filename : (filename || input.filename),
      dir: snapshot.settings.defaultDir || undefined,
      candidateUrls: pickerCandidates.length > 1 ? pickerCandidates : undefined,
      fileSize,
    };
  } else {
    input = {
      url: routedUrl,
      finalUrl: routedUrl !== url ? url : undefined,
      referer: pageUrl,
      cookie,
      filename: filename || filenameFromUrl(routedUrl),
      dir: snapshot.settings.defaultDir || undefined,
      candidateUrls: pickerCandidates.length > 1 ? pickerCandidates : undefined,
      fileSize,
    };
  }
  const resolvedCaptureType = captureType || getDownloadCaptureType(input);
  if (!snapshot.settings.captureTypes[resolvedCaptureType]) {
    return { ok: false, code: 'capture_type_disabled', message: `${resolvedCaptureType} capture is disabled` };
  }
  if (snapshot.settings.promptBeforeDownload || mediaCandidates.length > 1) {
    await openDownloadPicker(input, source);
    return { ok: true, result: 'picker-opened' };
  }
  await routeDownloadInput(input, snapshot, source);
  return { ok: true, result: 'routed' };
}
