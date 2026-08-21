import { enUS } from './locales/en-US';

export const dictionaries = {
  'en-US': enUS,
} as const;

export type Locale = keyof typeof dictionaries;
export type Dictionary = (typeof dictionaries)['en-US'];

export function translate(_locale: Locale, key: string, values?: Record<string, string | number>): string {
  const parts = key.split('.');
  let cursor: unknown = dictionaries['en-US'];
  for (const part of parts) {
    cursor = typeof cursor === 'object' && cursor !== null ? (cursor as Record<string, unknown>)[part] : undefined;
  }
  let message = typeof cursor === 'string' ? cursor : key;
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}
