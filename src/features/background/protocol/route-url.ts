import type { AddDownloadInput } from '@/library/rpc';
import type { RuntimeResponse } from '@/library/messages';
import type { DownloadCaptureType } from '@/library/storage';

import { loadSnapshot } from '@/library/storage';
import { filenameFromUrl } from '@/library/download/filename-metadata';
import { isCaptureTypeEnabled, isProtocolEnabled, isUrlBlocked } from '@/library/download/filter';

import { getCookieHeader } from '../cookies';
import { duplicateGuard } from '../downloads/state';
import { openDownloadPicker } from '../downloads/picker';
import { routeDownloadInput } from '../downloads/route-download-input';

export async function routeUrl(
  url: string,
  pageUrl: string,
  source: string,
  filename?: string,
  captureType?: DownloadCaptureType,
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
  if (!captureType && !isCaptureTypeEnabled({ url, filename }, snapshot.settings)) {
    return { ok: false, code: 'capture_type_disabled', message: 'This download type is disabled' };
  }
  if (!duplicateGuard.reserve([url, pageUrl])) {
    return { ok: true, result: 'duplicate-blocked' };
  }
  const cookie = snapshot.settings.forwardCookies ? await getCookieHeader(url) : undefined;
  const input: AddDownloadInput = {
    url,
    referer: pageUrl,
    cookie,
    filename: filename || filenameFromUrl(url),
    dir: snapshot.settings.defaultDir || undefined,
  };
  if (snapshot.settings.promptBeforeDownload) {
    await openDownloadPicker(input, source);
    return { ok: true, result: 'picker-opened' };
  }
  await routeDownloadInput(input, snapshot, source);
  return { ok: true, result: 'routed' };
}
