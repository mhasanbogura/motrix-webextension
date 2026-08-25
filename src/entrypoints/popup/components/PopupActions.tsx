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
  const hasTasks = taskCount > 0;
  const bulkButtonClass = 'w-full rounded-lg border-transparent bg-(--m3-surface) px-2 text-[11px] font-semibold';

  const clearButton = (
    <Button
      variant='outline'
      size='sm'
      className={`${bulkButtonClass} text-destructive`}
      disabled={busy || !hasTasks}
      onClick={onClearAll}
    >
      <Trash2 />
      {t('popup.clearAll')}
    </Button>
  );

  const openMotrixButton = (
    <Button
      className='w-full justify-center rounded-lg px-3 font-semibold shadow-(--m3-shadow-card)'
      size='sm'
      onClick={onWakeMotrix}
    >
      <Power />
      {t('common.openMotrix')}
    </Button>
  );

  return (
    <>
      <Separator className='mt-5' />
      <div data-reveal className='space-y-3 rounded-xl border bg-(--m3-surface-container) p-3'>
        {showPauseAll
          ? (
              <div className='grid grid-cols-3 gap-1.5'>
                <Button
                  variant='outline'
                  size='sm'
                  className={`${bulkButtonClass} text-(--m3-warning)`}
                  disabled={busy || !hasTasks}
                  onClick={onPauseAll}
                >
                  <Pause />
                  {t('popup.pauseAll')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  className={`${bulkButtonClass} text-(--m3-success)`}
                  disabled={busy || !hasTasks}
                  onClick={onResumeAll}
                >
                  <Play />
                  {t('popup.resumeAll')}
                </Button>
                {clearButton}
              </div>
            )
          : (
              <div className='grid grid-cols-2 gap-1.5'>
                {clearButton}
                {openMotrixButton}
              </div>
            )}
        {showPauseAll ? openMotrixButton : null}
      </div>
    </>
  );
}
