import type { RuntimeState } from '@/library/messages';

import { TaskRow } from '@/components/motrix/task-row';

import type { PopupTranslator, TaskLane } from '../types';

interface TaskPanelProps {
  t: PopupTranslator;
  activeLane: TaskLane;
  runtime: RuntimeState;
  onPause: (gid: string) => void;
  onResume: (gid: string) => void;
  onRetry: (gid: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
  onRemove: (gid: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
  onOpenLink: (gid: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
  onRename: (gid: string, filename: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
}

export function TaskPanel({
  activeLane,
  runtime,
  onPause,
  onResume,
  onRemove,
  onRename,
  onRetry,
  onOpenLink,
  t,
}: TaskPanelProps) {
  return (
    <section data-reveal className='mx-3 mt-3 rounded-xl border bg-(--m3-surface-container) p-3 shadow-(--m3-shadow-card)'>
      <TaskList
        tone={activeLane}
        tasks={runtime.tasks[activeLane]}
        empty={t('popup.noTasks')}
        onPause={onPause}
        onResume={onResume}
        onRemove={onRemove}
        onRename={onRename}
        onRetry={onRetry}
        onOpenLink={onOpenLink}
      />
    </section>
  );
}

function TaskList({
  tone,
  tasks,
  empty,
  onPause,
  onResume,
  onRemove,
  onRename,
  onRetry,
  onOpenLink,
}: {
  tone: TaskLane;
  tasks: RuntimeState['tasks']['active'];
  empty: string;
  onPause: (gid: string) => void;
  onResume: (gid: string) => void;
  onRename: (gid: string, filename: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
  onRetry: (gid: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
  onOpenLink: (gid: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
  onRemove: (gid: string, status: RuntimeState['tasks']['active'][number]['status']) => void;
}) {
  const listHeightClass = 'max-h-[108px] min-h-[108px]';

  return (
    <div className='min-h-[108px]'>
      {tasks.length
        ? (
            <div className={`${listHeightClass} snap-y snap-mandatory space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain pr-1`}>
              {tasks.map((task) => (
                <TaskRow
                  key={task.gid}
                  task={task}
                  className={tone === 'error' ? undefined : 'mx-auto w-[calc(100%-8px)]'}
                  compact={false}
                  tone={tone}
                  onPause={onPause}
                  onResume={onResume}
                  onRemove={onRemove}
                  onRename={onRename}
                  onRetry={onRetry}
                  onOpenLink={onOpenLink}
                />
              ))}
            </div>
          )
        : (
            <div className='pointer-events-none flex h-[108px] items-center justify-center rounded-md border border-dashed bg-(--m3-surface) p-5 text-center text-sm text-muted-foreground'>
              {empty}
            </div>
          )}
    </div>
  );
}
