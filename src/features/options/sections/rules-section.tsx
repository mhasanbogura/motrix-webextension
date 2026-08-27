import { useMemo, useState } from 'react';
import { ChevronDown, Save, Shield, Trash2 } from 'lucide-react';

import type { StorageSnapshot } from '@/library/storage';

import { cn } from '@/library/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

import type { ExtensionPanel, OptionsTranslator } from '../types';

import { Field } from '../components/field';
import { Section } from '../components/section';

interface RulesSectionProps {
  compact: boolean;
  t: OptionsTranslator;
  snapshot: StorageSnapshot;
  persistSettings: () => Promise<void>;
  updateSettings: (patch: Partial<StorageSnapshot['settings']>) => void;
  persistPickerRules: (pickerRules?: Record<string, boolean>) => Promise<void>;
}

export function RulesSection({
  compact,
  persistPickerRules,
  persistSettings,
  snapshot,
  t,
  updateSettings,
}: RulesSectionProps) {
  const [extensionPanel, setExtensionPanel] = useState<ExtensionPanel>('allowed');

  const blockedExtensions = useMemo(() => snapshot.settings.blockedExtensions.join('\n'), [snapshot.settings.blockedExtensions]);
  const allowedExtensions = useMemo(() => snapshot.settings.allowedExtensions.join('\n'), [snapshot.settings.allowedExtensions]);

  return (
    <Section title={t('options.rules')} icon={Shield} compact={compact}>
      <div className='rounded-2xl border bg-(--m3-surface) p-(--options-field-pad)'>
        <div className='mb-3'>
          <div className='text-sm font-semibold'>{t('options.siteFilePicker')}</div>
          <div className='text-xs text-muted-foreground'>{t('options.siteFilePickerHint')}</div>
        </div>
        <div className='space-y-2'>
          {Object.entries(snapshot.pickerRules).map(([pattern, enabled]) => (
            <div key={pattern} className='flex items-center gap-3 rounded-xl border bg-background p-3'>
              <Switch
                checked={enabled}
                onCheckedChange={(nextEnabled) => {
                  void persistPickerRules({ ...snapshot.pickerRules, [pattern]: nextEnabled });
                }}
                aria-label={`${t('options.siteFilePicker')}: ${pattern}`}
              />
              <Badge variant={enabled ? 'good' : 'destructive'}>
                {enabled ? t('common.enabled') : t('common.disabled')}
              </Badge>
              <span className='min-w-0 flex-1 truncate text-sm' title={pattern}>{pattern}</span>
              <Button
                variant='quiet'
                size='icon'
                title={t('common.remove')}
                onClick={() => {
                  const nextRules = { ...snapshot.pickerRules };
                  delete nextRules[pattern];
                  void persistPickerRules(nextRules);
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        {!Object.keys(snapshot.pickerRules).length
          ? (
              <div className='rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground'>
                {t('options.noPickerRules')}
              </div>
            )
          : null}
      </div>
      <Separator />
      <div className='rounded-2xl border bg-(--m3-surface) p-(--options-field-pad)'>
        <div className='mb-3 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-stretch'>
          <div>
            <div className='text-sm font-semibold'>{t('options.extensionFilters')}</div>
            <div className='text-xs text-muted-foreground'>{t('options.extensionFilterHint')}</div>
          </div>
          <div className='grid grid-cols-2 overflow-hidden rounded-lg border bg-background'>
            <button
              type='button'
              onClick={() => setExtensionPanel('allowed')}
              className={cn(
                'flex min-h-10 cursor-pointer items-center justify-center gap-2 border-r px-3 text-sm font-semibold',
                extensionPanel === 'allowed'
                  ? 'bg-(--m3-primary-container) text-(--m3-on-primary-container)'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('options.allowedExtensions')}
              <ChevronDown className={cn('size-4 transition-transform', extensionPanel === 'allowed' && 'rotate-180')} />
            </button>
            <button
              type='button'
              onClick={() => setExtensionPanel('blocked')}
              className={cn(
                'flex min-h-10 cursor-pointer items-center justify-center gap-2 px-3 text-sm font-semibold',
                extensionPanel === 'blocked'
                  ? 'bg-(--m3-primary-container) text-(--m3-on-primary-container)'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('options.blockedExtensions')}
              <ChevronDown className={cn('size-4 transition-transform', extensionPanel === 'blocked' && 'rotate-180')} />
            </button>
          </div>
        </div>
        {extensionPanel === 'allowed'
          ? (
              <Field label={t('options.allowedExtensions')} compact={compact}>
                <Textarea
                  className='min-h-28'
                  value={allowedExtensions}
                  onChange={(event) => updateSettings({
                    allowedExtensions: splitLines(event.target.value),
                  })}
                />
              </Field>
            )
          : (
              <Field label={t('options.blockedExtensions')} compact={compact}>
                <Textarea
                  className='min-h-28'
                  value={blockedExtensions}
                  onChange={(event) => updateSettings({
                    blockedExtensions: splitLines(event.target.value),
                  })}
                />
              </Field>
            )}
      </div>
      <div className='flex justify-end'>
        <Button onClick={() => void persistSettings()}>
          <Save />
          {t('common.save')}
        </Button>
      </div>
    </Section>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
}
