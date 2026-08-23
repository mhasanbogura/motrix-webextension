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
  if (!isProtocolEnabled(url, snapshot.settings)) {
    return { ok: false, code: 'disabled', message: 'This protocol is disabled' };
  }
  if (isUrlBlocked(url, pageUrl, snapshot.settings, snapshot.siteRules)) {
    return { ok: false, code: 'site_rule_blocked', message: 'Downloads are blocked for this site' };
  }
  if (captureType && !snapshot.settings.captureTypes[captureType]) {
    return { ok: false, code: 'capture_type_disabled', message: `${captureType} capture is disabled` };
  }
  if (!duplicateGuard.reserve([url, pageUrl])) {
    return { ok: true, result: 'duplicate-blocked' };
  }
  const cookie = snapshot.settings.forwardCookies ? await getCookieHeader(url) : undefined;
  const mediaCandidates = [url, ...(candidateUrls || [])]
    .filter((candidate, index, values) => isHttpUrl(candidate) && values.indexOf(candidate) === index);
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
      candidateUrls: mediaCandidates.length > 1 ? mediaCandidates : undefined,
      fileSize,
    };
  } else {
    input = {
      url,
      referer: pageUrl,
      cookie,
      filename: filename || filenameFromUrl(url),
      dir: snapshot.settings.defaultDir || undefined,
      candidateUrls: mediaCandidates.length > 1 ? mediaCandidates : undefined,
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
