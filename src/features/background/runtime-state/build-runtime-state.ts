import type { Aria2Task } from '@/library/rpc';
import type { StorageSnapshot } from '@/library/storage';
import type { PopupState, RuntimeState } from '@/library/messages';

import { Aria2RpcClient } from '@/library/rpc';
import { loadSnapshot, updateConnection } from '@/library/storage';

const POPUP_RPC_TIMEOUT_MS = 1200;

export async function buildPopupState(): Promise<PopupState> {
  const snapshot = await loadSnapshot();
  const runtime = await buildRuntimeState(snapshot);
  return {
    snapshot: runtime.connection.ok && !snapshot.connection.verifiedAt ? await loadSnapshot() : snapshot,
    runtime,
  };
}

export async function buildRuntimeState(snapshot: StorageSnapshot): Promise<RuntimeState> {
  const client = new Aria2RpcClient({
    ...snapshot.connection,
    timeoutMs: Math.min(snapshot.connection.timeoutMs, POPUP_RPC_TIMEOUT_MS),
  });
  const connection = await client.checkConnection();
  const base = {
    connection: { ...connection, checkedAt: Date.now() },
    tasks: { active: [], waiting: [], stopped: [] },
  };
  if (!connection.ok) return base;
  if (!snapshot.connection.verifiedAt) {
    await updateConnection({ verifiedAt: Date.now() });
  }
  const [statResult, activeResult, waitingResult, stoppedResult] = await Promise.allSettled([
    client.getGlobalStat(),
    client.tellActive(),
    client.tellWaiting(0, 20),
    client.tellStopped(0, 20),
  ]);
  return {
    ...base,
    stat: statResult.status === 'fulfilled' ? statResult.value : undefined,
    tasks: {
      active: activeResult.status === 'fulfilled'
        ? applyTaskNameOverrides(activeResult.value, snapshot.taskNameOverrides)
        : [],
      waiting: waitingResult.status === 'fulfilled'
        ? applyTaskNameOverrides(waitingResult.value, snapshot.taskNameOverrides)
        : [],
      stopped: stoppedResult.status === 'fulfilled'
        ? applyTaskNameOverrides(stoppedResult.value, snapshot.taskNameOverrides)
        : [],
    },
  };
}

function applyTaskNameOverrides(tasks: Aria2Task[], overrides: Record<string, string>): Aria2Task[] {
  return tasks.map((task) => {
    const override = overrides[task.gid];
    if (!override) return task;

    const selectedFile = task.files?.find((file) => file.selected === 'true') ?? task.files?.[0];
    if (!selectedFile) return { ...task, displayName: override };

    const separatorIndex = Math.max(selectedFile.path.lastIndexOf('/'), selectedFile.path.lastIndexOf('\\\\'));
    const displayPath = separatorIndex >= 0
      ? `${selectedFile.path.slice(0, separatorIndex + 1)}${override}`
      : override;
    return {
      ...task,
      displayName: override,
      files: task.files?.map((file) => file.index === selectedFile.index ? { ...file, path: displayPath } : file),
    };
  });
}
