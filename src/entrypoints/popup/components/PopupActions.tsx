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
      <div data-reveal className='space-y-2 rounded-xl border bg-(--m3-surface-container) p-2'>
        <div className={showPauseAll ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-1 gap-1.5'}>
          {showPauseAll
            ? (
                <Button
                  variant='outline'
                  size='sm'
                  className='w-full rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold text-(--m3-warning)'
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
                  className='w-full rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold text-(--m3-success)'
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
            className='w-full rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold text-destructive'
            disabled={busy || !hasTasks}
            onClick={onClearAll}
          >
            <Trash2 />
            {t('popup.clearAll')}
          </Button>
        </div>
        <Button
          className='w-full justify-center rounded-lg px-3 font-semibold shadow-(--m3-shadow-card)'
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
