import {
  type ConnectionConfig,
  DEFAULT_STORAGE,
  type DiagnosticEvent,
  type DownloadSettings,
  type SiteRule,
  type StorageSnapshot,
  StorageSnapshotSchema,
  type UiPrefs,
} from './schema';

const STORAGE_KEY = 'motrixExtension';
const MAX_DIAGNOSTICS = 200;
const MAX_TASK_NAME_OVERRIDES = 500;
const MAX_TASK_SOURCE_URLS = 500;
const MAX_TASK_CREATED_AT = 1000;
const AUTH_CONNECTION_FIELDS = ['host', 'port', 'path', 'secret'] as const;

export async function loadSnapshot(): Promise<StorageSnapshot> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const result = StorageSnapshotSchema.safeParse(raw[STORAGE_KEY] ?? DEFAULT_STORAGE);
  return result.success ? result.data : DEFAULT_STORAGE;
}

export async function saveSnapshot(snapshot: StorageSnapshot): Promise<void> {
  const parsed = StorageSnapshotSchema.parse(snapshot);
  await browser.storage.local.set({ [STORAGE_KEY]: parsed });
}

export async function updateSnapshot(
  updater: (current: StorageSnapshot) => StorageSnapshot | Promise<StorageSnapshot>,
): Promise<StorageSnapshot> {
  const current = await loadSnapshot();
  const next = await updater(current);
  await saveSnapshot(next);
  return next;
}

export async function updateConnection(patch: Partial<ConnectionConfig>): Promise<StorageSnapshot> {
  return updateSnapshot((current) => ({
    ...current,
    connection: {
      ...current.connection,
      ...patch,
      verifiedAt: hasAuthConnectionChange(current.connection, patch)
        ? 0
        : (patch.verifiedAt ?? current.connection.verifiedAt),
    },
  }));
}

function hasAuthConnectionChange(
  current: ConnectionConfig,
  patch: Partial<ConnectionConfig>,
): boolean {
  return AUTH_CONNECTION_FIELDS.some((field) => field in patch && patch[field] !== current[field]);
}

export async function updateSettings(patch: Partial<DownloadSettings>): Promise<StorageSnapshot> {
  return updateSnapshot((current) => ({
    ...current,
    settings: { ...current.settings, ...patch },
  }));
}

export async function updateUi(patch: Partial<UiPrefs>): Promise<StorageSnapshot> {
  return updateSnapshot((current) => ({
    ...current,
    ui: { ...current.ui, ...patch },
  }));
}

export async function saveSiteRules(siteRules: SiteRule[]): Promise<StorageSnapshot> {
  return updateSnapshot((current) => ({ ...current, siteRules }));
}

export async function saveTaskNameOverride(gid: string, filename: string): Promise<StorageSnapshot> {
  return updateSnapshot((current) => {
    const entries = Object.entries(current.taskNameOverrides).filter(([key]) => key !== gid);
    return {
      ...current,
      taskNameOverrides: Object.fromEntries([...entries, [gid, filename]].slice(-MAX_TASK_NAME_OVERRIDES)),
    };
  });
}

export async function saveTaskSourceUrl(gid: string, url: string): Promise<StorageSnapshot> {
  return updateSnapshot((current) => {
    const entries = Object.entries(current.taskSourceUrls).filter(([key]) => key !== gid);
    return {
      ...current,
      taskSourceUrls: Object.fromEntries([...entries, [gid, url]].slice(-MAX_TASK_SOURCE_URLS)),
    };
  });
}

export async function saveTaskCreatedAt(gid: string, createdAt = Date.now()): Promise<StorageSnapshot> {
  return updateSnapshot((current) => {
    const entries = Object.entries(current.taskCreatedAt).filter(([key]) => key !== gid);
    return {
      ...current,
      taskCreatedAt: Object.fromEntries([...entries, [gid, createdAt]].slice(-MAX_TASK_CREATED_AT)),
    };
  });
}

export async function ensureTaskCreatedAt(gids: string[]): Promise<Record<string, number>> {
  const current = await loadSnapshot();
  const missing = gids.filter((gid) => !(gid in current.taskCreatedAt));
  if (!missing.length) return current.taskCreatedAt;
  const createdAt = Date.now();
  const entries = Object.entries(current.taskCreatedAt);
  const additions = missing.map((gid, index) => [gid, createdAt + index] as const);
  const next = Object.fromEntries([...entries, ...additions].slice(-MAX_TASK_CREATED_AT));
  await saveSnapshot({ ...current, taskCreatedAt: next });
  return next;
}

export async function appendDiagnostic(event: Omit<DiagnosticEvent, 'id' | 'timestamp'>): Promise<void> {
  await updateSnapshot((current) => ({
    ...current,
    diagnostics: [
      {
        ...event,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      },
      ...current.diagnostics,
    ].slice(0, MAX_DIAGNOSTICS),
  }));
}

export async function clearDiagnostics(): Promise<StorageSnapshot> {
  return updateSnapshot((current) => ({ ...current, diagnostics: [] }));
}
