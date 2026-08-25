import { z } from 'zod';

import type { Locale } from '@/library/i18n/dictionaries';

export const ThemeSchema = z.enum(['system', 'light', 'dark']);
export const LocaleSchema = z.preprocess(() => 'en-US', z.literal('en-US'));
export const DensitySchema = z.enum(['comfortable', 'compact']);

export const ConnectionConfigSchema = z.object({
  host: z.string().min(1).default('127.0.0.1'),
  port: z.coerce.number().int().min(1).max(65535).default(16800),
  path: z.string().min(1).default('/jsonrpc'),
  secret: z.string().default(''),
  timeoutMs: z.coerce.number().int().min(500).max(30000).default(5000),
  verifiedAt: z.coerce.number().int().min(0).default(0),
});

export const DownloadCaptureTypeSchema = z.enum(['audio', 'video', 'image', 'document', 'archive', 'other']);
export type DownloadCaptureType = z.infer<typeof DownloadCaptureTypeSchema>;

export const DownloadCaptureTypesSchema = z.object({
  audio: z.boolean().default(true),
  video: z.boolean().default(true),
  image: z.boolean().default(true),
  document: z.boolean().default(true),
  archive: z.boolean().default(true),
  other: z.boolean().default(true),
});

export const DEFAULT_DOWNLOAD_CAPTURE_TYPES = DownloadCaptureTypesSchema.parse({});

export const DownloadSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  interceptHttp: z.boolean().default(true),
  interceptMagnet: z.boolean().default(true),
  interceptEd2k: z.boolean().default(true),
  interceptThunder: z.boolean().default(true),
  forwardCookies: z.boolean().default(true),
  forwardHeaders: z.boolean().default(true),
  autoLaunchApp: z.boolean().default(true),
  promptBeforeDownload: z.boolean().default(true),
  hideChromeDownload: z.boolean().default(true),
  minFileSizeBytes: z.coerce.number().int().min(0).default(0),
  captureTypes: DownloadCaptureTypesSchema.default(DEFAULT_DOWNLOAD_CAPTURE_TYPES),
  blockedExtensions: z.array(z.string()).default([]),
  allowedExtensions: z.array(z.string()).default([]),
  defaultDir: z.string().default(''),
});

export const SiteRuleSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  action: z.enum(['allow', 'block']),
  enabled: z.boolean().default(true),
});

export const UiPrefsSchema = z.object({
  locale: LocaleSchema.default('en-US'),
  theme: ThemeSchema.default('system'),
  density: DensitySchema.default('comfortable'),
  motion: z.boolean().default(true),
  showContextMenu: z.boolean().default(true),
});

export const DiagnosticEventSchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  code: z.string(),
  message: z.string(),
  timestamp: z.number(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const DEFAULT_CONNECTION = ConnectionConfigSchema.parse({});
export const DEFAULT_DOWNLOAD_SETTINGS = DownloadSettingsSchema.parse({});
export const DEFAULT_UI_PREFS = UiPrefsSchema.parse({});

export const StorageSnapshotSchema = z.object({
  connection: ConnectionConfigSchema.default(DEFAULT_CONNECTION),
  settings: DownloadSettingsSchema.default(DEFAULT_DOWNLOAD_SETTINGS),
  siteRules: z.array(SiteRuleSchema).default([]),
  ui: UiPrefsSchema.default(DEFAULT_UI_PREFS),
  diagnostics: z.array(DiagnosticEventSchema).default([]),
  taskNameOverrides: z.record(z.string(), z.string()).default({}),
  taskSourceUrls: z.record(z.string(), z.string()).default({}),
  taskCreatedAt: z.record(z.string(), z.number()).default({}),
});

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;
export type DownloadSettings = z.infer<typeof DownloadSettingsSchema>;
export type SiteRule = z.infer<typeof SiteRuleSchema>;
export type UiPrefs = z.infer<typeof UiPrefsSchema> & { locale: Locale };
export type DiagnosticEvent = z.infer<typeof DiagnosticEventSchema>;
export type StorageSnapshot = z.infer<typeof StorageSnapshotSchema>;

export const DEFAULT_STORAGE: StorageSnapshot = StorageSnapshotSchema.parse({});
