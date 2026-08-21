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
      active: activeResult.status === 'fulfilled' ? activeResult.value : [],
      waiting: waitingResult.status === 'fulfilled' ? waitingResult.value : [],
      stopped: stoppedResult.status === 'fulfilled' ? stoppedResult.value : [],
    },
  };
}
