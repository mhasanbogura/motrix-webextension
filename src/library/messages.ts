import type { Aria2GlobalStat, Aria2Task, Aria2TaskStatus } from '@/library/rpc';
import type {
  ConnectionConfig,
  DiagnosticEvent,
  DownloadCaptureType,
  DownloadSettings,
  SiteRule,
  StorageSnapshot,
  UiPrefs,
} from '@/library/storage';

export interface PopupState {
  runtime: RuntimeState;
  snapshot: StorageSnapshot;
}

export interface RuntimeState {
  stat?: Aria2GlobalStat;
  tasks: {
    active: Aria2Task[];
    error: Aria2Task[];
    stopped: Aria2Task[];
  };
  connection: {
    ok: boolean;
    code?: string;
    message: string;
    version?: string;
    latencyMs?: number;
    checkedAt: number;
  };
}

export type RuntimeTaskLane = keyof RuntimeState['tasks'];

export type ContextMenuTargetSource = 'link' | 'media' | 'selection' | 'page';

export interface ContextMenuTarget {
  url?: string;
  pageUrl: string;
  filename?: string;
  source: ContextMenuTargetSource;
  captureType?: DownloadCaptureType;
}

export type RuntimeMessage
  = | { type: 'popup-state' }
    | { type: 'runtime-state' }
    | { type: 'settings-snapshot' }
    | { type: 'test-connection'; connection?: ConnectionConfig }
    | { type: 'update-settings'; patch: Partial<DownloadSettings> }
    | { type: 'update-connection'; patch: Partial<ConnectionConfig> }
    | { type: 'update-ui'; patch: Partial<UiPrefs> }
    | { type: 'save-site-rules'; siteRules: SiteRule[] }
    | { type: 'add-url'; url: string; pageUrl?: string; filename?: string }
    | { type: 'task-action'; action: 'pause' | 'resume' | 'remove'; gid: string; status?: Aria2TaskStatus }
    | { type: 'rename-task'; gid: string; filename: string; status?: Aria2TaskStatus }
    | { type: 'retry-task'; gid: string; status?: Aria2TaskStatus }
    | { type: 'open-task-link'; gid: string; status?: Aria2TaskStatus }
    | { type: 'pause-all'; gids?: string[] }
    | { type: 'resume-all' }
    | { type: 'clear-tasks'; lane: RuntimeTaskLane; gids: string[] }
    | { type: 'wake-motrix' }
    | { type: 'content-protocol-click'; url: string; pageUrl: string; filename?: string }
    | { type: 'capture-url'; url: string; pageUrl: string; source: ContextMenuTargetSource; filename?: string; captureType?: DownloadCaptureType }
    | { type: 'capture-site-status'; url: string; pageUrl: string }
    | { type: 'resolve-context-menu-target' }
    | { type: 'picker:get'; id: string }
    | { type: 'picker:submit'; id: string; filename: string }
    | { type: 'picker:cancel'; id: string }
    | { type: 'append-diagnostic'; event: Omit<DiagnosticEvent, 'id' | 'timestamp'> }
    | { type: 'clear-diagnostics' }
    | { type: 'restore-defaults' }
    | { type: 'replace-snapshot'; snapshot: StorageSnapshot };

export type RuntimeResponse
  = | {
    ok: true;
    state?: PopupState;
    runtime?: RuntimeState;
    snapshot?: StorageSnapshot;
    diagnostics?: DiagnosticEvent[];
    contextMenuTarget?: ContextMenuTarget;
    result?: unknown;
  }
  | { ok: false; code: string; message: string };
