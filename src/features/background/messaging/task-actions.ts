import type { RuntimeTaskLane } from '@/library/messages';
import type { Aria2Task, Aria2TaskStatus } from '@/library/rpc';

import { Aria2RpcClient } from '@/library/rpc';
import { loadSnapshot } from '@/library/storage';
import { renameLocalFile } from '@/library/social/resolver';
import { sanitizeFilename } from '@/library/download/filename-metadata';

export async function performTaskAction(
  action: 'pause' | 'resume' | 'remove',
  gid: string,
  status?: Aria2TaskStatus,
): Promise<void> {
  await withClient((client) => {
    if (action === 'pause') return client.pause(gid);
    if (action === 'resume') return client.resume(gid);
    if (isDownloadResultStatus(status)) return client.removeDownloadResult(gid);
    return client.remove(gid);
  });
}

export async function renameTask(gid: string, filename: string, status?: Aria2TaskStatus): Promise<void> {
  const cleanFilename = sanitizeFilename(filename).replace(/\s+/g, ' ').trim();
  if (!cleanFilename) throw new Error('Enter a filename before saving the rename');
  const snapshot = await loadSnapshot();
  const client = new Aria2RpcClient(snapshot.connection);
  if (isDownloadResultStatus(status)) {
    const task = await findTask(client, gid, status);
    const filePath = task.files?.find((file) => file.selected === 'true')?.path || task.files?.[0]?.path;
    if (!filePath) throw new Error('The completed download has no local file path');
    await renameLocalFile(filePath, cleanFilename);
    return;
  }
  await client.changeOption(gid, { out: cleanFilename });
}

async function findTask(client: Aria2RpcClient, gid: string, status: Aria2TaskStatus): Promise<Aria2Task> {
  const tasks = status === 'active'
    ? await client.tellActive()
    : status === 'waiting' || status === 'paused'
      ? await client.tellWaiting(0, 1000)
      : await client.tellStopped(0, 1000);
  const task = tasks.find((item) => item.gid === gid);
  if (!task) throw new Error('The task is no longer available');
  return task;
}

export async function clearTasks(lane: RuntimeTaskLane, gids: string[]): Promise<void> {
  await withClient(async (client) => {
    if (lane === 'stopped') {
      await client.purgeDownloadResult();
      return;
    }
    await Promise.all(gids.map((gid) => client.remove(gid)));
  });
}

export async function pauseTasks(gids: string[]): Promise<void> {
  await withClient(async (client) => {
    await Promise.all(gids.map((gid) => client.pause(gid)));
  });
}

function isDownloadResultStatus(
  status?: Aria2TaskStatus,
): status is Extract<Aria2TaskStatus, 'complete' | 'error' | 'removed'> {
  return status === 'complete' || status === 'error' || status === 'removed';
}

export async function withClient<T>(operation: (client: Aria2RpcClient) => Promise<T>): Promise<T> {
  const snapshot = await loadSnapshot();
  return operation(new Aria2RpcClient(snapshot.connection));
}
