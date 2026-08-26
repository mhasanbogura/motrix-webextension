import { Pause, Play, Power, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

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
  const footerButtonClass = 'h-8 min-h-8 max-h-8 min-w-0 w-full justify-center gap-1 overflow-hidden rounded-lg px-0 py-0 text-[8px] leading-none font-medium whitespace-nowrap';
  const bulkButtonClass = `${footerButtonClass} border-transparent bg-(--m3-surface)`;
  const activeFooterButtonClass = 'h-7 min-h-7 max-h-7 min-w-0 w-full justify-center gap-0.5 overflow-hidden rounded-lg px-0 py-0 text-[7px] leading-none font-medium whitespace-nowrap';
  const activeBulkButtonClass = `${activeFooterButtonClass} border-transparent bg-(--m3-surface)`;

  const clearButton = (
    <Button
      variant='outline'
      size='sm'
      className={`${bulkButtonClass} text-destructive`}
      disabled={busy || !hasTasks}
      onClick={onClearAll}
    >
      <Trash2 className='size-2.5!' />
      {t('popup.clearAll')}
    </Button>
  );

  const openMotrixButton = (
    <Button
      className={`${footerButtonClass} shadow-(--m3-shadow-card)`}
      size='sm'
      onClick={onWakeMotrix}
    >
      <Power className='size-2.5!' />
      {t('common.openMotrix')}
    </Button>
  );

  const activeClearButton = (
    <Button
      variant='outline'
      size='sm'
      className={`${activeBulkButtonClass} text-destructive`}
      disabled={busy || !hasTasks}
      onClick={onClearAll}
    >
      <Trash2 className='size-2!' />
      {t('popup.clearAll')}
    </Button>
  );

  const activeOpenMotrixButton = (
    <Button
      className={`${activeFooterButtonClass} shadow-(--m3-shadow-card)`}
      size='sm'
      onClick={onWakeMotrix}
    >
      <Power className='size-2!' />
      {t('common.openMotrix')}
    </Button>
  );

  return (
    <div data-reveal className='mx-3 mt-3 mb-3 space-y-3 overflow-hidden rounded-xl border bg-(--m3-surface-container) p-3'>
      {showPauseAll
        ? (
            <div className='grid grid-cols-[repeat(4,minmax(0,1fr))] gap-1 overflow-hidden rounded-xl'>
              <Button
                variant='outline'
                size='sm'
                className={`${activeBulkButtonClass} text-(--m3-warning)`}
                disabled={busy || !hasTasks}
                onClick={onPauseAll}
              >
                <Pause className='size-2!' />
                {t('popup.pauseAll')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                className={`${activeBulkButtonClass} text-(--m3-success)`}
                disabled={busy || !hasTasks}
                onClick={onResumeAll}
              >
                <Play className='size-2!' />
                {t('popup.resumeAll')}
              </Button>
              {activeClearButton}
              {activeOpenMotrixButton}
            </div>
          )
        : (
            <div className='grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1.5 overflow-hidden rounded-xl'>
              {clearButton}
              {openMotrixButton}
            </div>
          )}
    </div>
  );
}
