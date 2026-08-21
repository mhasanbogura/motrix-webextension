import { Link2, Send } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sendRuntimeMessage } from '@/library/runtime';

import type { PopupTranslator } from '../types';

interface PasteLinkPanelProps {
  t: PopupTranslator;
}

export function PasteLinkPanel({ t }: PasteLinkPanelProps) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'muted' | 'error'>('muted');

  async function submit(): Promise<void> {
    const value = url.trim();
    if (!value) {
      setFeedback('Paste a link before sending it to Motrix.');
      setFeedbackTone('error');
      return;
    }

    setBusy(true);
    setFeedback('');
    try {
      const response = await sendRuntimeMessage({
        type: 'add-url',
        url: value,
        pageUrl: globalThis.location.href,
      });
      if (!response.ok) {
        setFeedback(response.message || t('popup.sendFailed'));
        setFeedbackTone('error');
        return;
      }
      setUrl('');
      setFeedback(t('popup.sent'));
      setFeedbackTone('muted');
    } catch (reason: unknown) {
      setFeedback(reason instanceof Error ? reason.message : String(reason));
      setFeedbackTone('error');
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <section className='mx-3 mb-3 rounded-2xl border bg-(--m3-surface-container) p-3 shadow-(--m3-shadow-card)'>
      <div className='mb-2 flex items-center gap-2'>
        <span className='flex size-7 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground'>
          <Link2 className='size-4' />
        </span>
        <div className='min-w-0'>
          <p className='text-xs font-semibold'>{t('popup.addTask')}</p>
          <p className='truncate text-[10px] text-muted-foreground'>{t('popup.addTaskPlaceholder')}</p>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Input
          value={url}
          placeholder={t('popup.addTaskPlaceholder')}
          onChange={(event) => {
            setUrl(event.target.value);
            if (feedback) setFeedback('');
          }}
          onKeyDown={handleKeyDown}
          disabled={busy}
          spellCheck={false}
          aria-label={t('popup.addTask')}
        />
        <Button size='sm' className='shrink-0' onClick={() => void submit()} disabled={busy || !url.trim()}>
          <Send />
          {busy ? 'Sending…' : t('common.add')}
        </Button>
      </div>
      {feedback
        ? (
            <p className={`mt-2 text-[11px] ${feedbackTone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role='status'>
              {feedback}
            </p>
          )
        : null}
    </section>
  );
}
