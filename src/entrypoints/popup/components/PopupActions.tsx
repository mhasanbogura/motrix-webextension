import { Pause, Play, Power, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import type { PopupTranslator, TaskLane } from '../types';

interface PopupActionsProps {
  busy: boolean;
  taskCount: number;
  t: PopupTranslator;
  activeLane: TaskLane;
  onClearAll: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onWakeMotrix: () => void;
}

export function PopupActions({
  activeLane,
  busy,
  onClearAll,
  onPauseAll,
  onResumeAll,
  onWakeMotrix,
  taskCount,
  t,
}: PopupActionsProps) {
  const showPauseAll = activeLane === 'active';
  const showResumeAll = activeLane === 'active';
  const hasTasks = taskCount > 0;

  return (
    <>
      <Separator className='mt-3' />
      <div data-reveal className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-(--m3-surface-container) p-2'>
        <div className='flex min-w-0 flex-wrap items-center gap-1'>
          {showPauseAll
            ? (
                <Button
                  variant='outline'
                  size='sm'
                  className='rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold'
                  disabled={busy || !hasTasks}
                  onClick={onPauseAll}
                >
                  <Pause />
                  {t('popup.pauseAll')}
                </Button>
              )
            : null}
          {showResumeAll
            ? (
                <Button
                  variant='outline'
                  size='sm'
                  className='rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold'
                  disabled={busy || !hasTasks}
                  onClick={onResumeAll}
                >
                  <Play />
                  {t('popup.resumeAll')}
                </Button>
              )
            : null}
          <Button
            variant='outline'
            size='sm'
            className='rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold text-destructive'
            disabled={busy || !hasTasks}
            onClick={onClearAll}
          >
            <Trash2 />
            {t('popup.clearAll')}
          </Button>
        </div>
        <Button
          className='shrink-0 rounded-lg px-3 font-semibold shadow-(--m3-shadow-card)'
          size='sm'
          onClick={onWakeMotrix}
        >
          <Power />
          {t('common.openMotrix')}
        </Button>
      </div>
    </>
  );
}
