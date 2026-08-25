import { type KeyboardEvent, useState } from 'react';
import { Check, ExternalLink, Pause, Pencil, Play, RotateCcw, Trash2, X } from 'lucide-react';

import type { Aria2Task } from '@/library/rpc';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatBytes, formatSpeed, percent } from '@/library/utils';

import { getTaskName } from './task-name';

type TaskRowTone = 'active' | 'error' | 'stopped';

interface TaskRowProps {
  task: Aria2Task;
  tone: TaskRowTone;
  onPause: (gid: string) => void;
  onResume: (gid: string) => void;
  onRetry: (gid: string, status: Aria2Task['status']) => void;
  onRemove: (gid: string, status: Aria2Task['status']) => void;
  onOpenLink: (gid: string, status: Aria2Task['status']) => void;
  onRename: (gid: string, filename: string, status: Aria2Task['status']) => void;
}

const toneClassNames: Record<TaskRowTone, string> = {
  active: 'border-task-active/30 bg-[color-mix(in_srgb,hsl(var(--task-active))_7%,var(--m3-surface))]',
  error: 'border-destructive/30 bg-[color-mix(in_srgb,hsl(var(--destructive))_7%,var(--m3-surface))]',
  stopped: 'border-task-stopped/30 bg-[color-mix(in_srgb,hsl(var(--task-stopped))_7%,var(--m3-surface))]',
};

export function TaskRow({ task, tone, onPause, onResume, onRemove, onRename, onRetry, onOpenLink }: TaskRowProps) {
  const progress = percent(task.completedLength, task.totalLength);
  const isActive = task.status === 'active';
  const isPaused = task.status === 'paused' || task.status === 'waiting';
  const taskName = getTaskName(task);
  const completedSize = formatBytes(task.completedLength);
  const totalSize = formatBytes(task.totalLength);
  const downloadSpeed = formatSpeed(task.downloadSpeed);
  const uploadSpeed = formatSpeed(task.uploadSpeed);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(taskName);

  function startRenaming(): void {
    setDraftName(taskName);
    setIsRenaming(true);
  }

  function cancelRenaming(): void {
    setDraftName(taskName);
    setIsRenaming(false);
  }

  function saveRenaming(): void {
    const cleanName = draftName.trim();
    if (!cleanName) return;
    onRename(task.gid, cleanName, task.status);
    setIsRenaming(false);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveRenaming();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelRenaming();
    }
  }

  return (
    <div
      data-reveal
      className={cn(
        'h-[136px] min-h-[136px] snap-start overflow-hidden rounded-lg border py-2 pr-3 pl-3 shadow-(--m3-shadow-card) transition-colors duration-200',
        toneClassNames[tone],
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 flex-1 pt-0.5'>
          {isRenaming
            ? (
                <div className='flex min-w-0 items-center gap-1'>
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    className='h-7 min-w-0 flex-1 rounded-md border bg-(--m3-surface) px-2 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    autoFocus
                    spellCheck={false}
                    aria-label='File name'
                  />
                  <Button variant='quiet' size='icon' className='size-7 shrink-0 rounded-full' title='Save name' aria-label='Save name' onClick={saveRenaming} disabled={!draftName.trim()}>
                    <Check />
                  </Button>
                  <Button variant='quiet' size='icon' className='size-7 shrink-0 rounded-full' title='Cancel rename' aria-label='Cancel rename' onClick={cancelRenaming}>
                    <X />
                  </Button>
                </div>
              )
            : (
                <div className='flex min-w-0 items-center gap-1'>
                  <div className='min-w-0 flex-1 truncate text-[13px] leading-snug font-semibold' title={taskName}>{taskName}</div>
                  <Button variant='quiet' size='icon' className='size-6 shrink-0 rounded-full' title='Rename' aria-label={`Rename ${taskName}`} onClick={startRenaming}>
                    <Pencil />
                  </Button>
                </div>
              )}
          <div className='mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground'>
            <Badge variant={isActive ? 'good' : isPaused ? 'warn' : 'quiet'} className='shrink-0 rounded-full px-1.5 py-0 text-[10px]/4'>
              {task.status}
            </Badge>
            <span className='metric-font max-w-33 min-w-21 shrink truncate' title={`${completedSize} / ${totalSize}`}>
              {completedSize}
              {' '}
              /
              {totalSize}
            </span>
            {task.status === 'active' && !task.errorMessage
              ? (
                  <span className='metric-font ml-auto grid max-w-39 min-w-0 shrink grid-cols-2 gap-1 overflow-hidden text-right text-[11px]/4'>
                    <span className='truncate text-speed-download' title={downloadSpeed}>
                      ↓
                      {downloadSpeed}
                    </span>
                    <span className='truncate text-speed-upload' title={uploadSpeed}>
                      ↑
                      {uploadSpeed}
                    </span>
                  </span>
                )
              : null}
          </div>
        </div>
        <div className='flex shrink-0 gap-1'>
          {task.status === 'error'
            ? (
                <>
                  <Button variant='quiet' size='icon' className='size-7 rounded-full' title='Retry' aria-label='Retry' onClick={() => onRetry(task.gid, task.status)}>
                    <RotateCcw />
                  </Button>
                  <Button variant='quiet' size='icon' className='size-7 rounded-full' title='Open link' aria-label='Open link' onClick={() => onOpenLink(task.gid, task.status)}>
                    <ExternalLink />
                  </Button>
                </>
              )
            : isActive
              ? (
                  <Button variant='quiet' size='icon' className='size-7 rounded-full' title='Pause' aria-label='Pause' onClick={() => onPause(task.gid)}>
                    <Pause />
                  </Button>
                )
              : (
                  <Button variant='quiet' size='icon' className='size-7 rounded-full' title='Resume' aria-label='Resume' onClick={() => onResume(task.gid)}>
                    <Play />
                  </Button>
                )}
          <Button variant='quiet' size='icon' className='size-7 rounded-full' title='Remove' aria-label='Remove' onClick={() => onRemove(task.gid, task.status)}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className='mt-2 flex items-center gap-2'>
        <Progress value={progress} />
        <span className='metric-font pointer-events-none w-10 text-right text-[11px] text-muted-foreground'>
          {progress.toFixed(0)}
          %
        </span>
      </div>
      <div className='mt-1 flex min-h-4 items-start text-[11px]/4 text-muted-foreground'>
        {task.errorMessage
          ? (
              <span className='break-words whitespace-normal text-destructive' title={task.errorMessage}>{task.errorMessage}</span>
            )
          : null}
      </div>
    </div>
  );
}
