import type { RuntimeMessage, RuntimeResponse } from './messages';

const RUNTIME_MESSAGE_TIMEOUT_MS = 5000;

export async function sendRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  try {
    return await Promise.race([
      browser.runtime.sendMessage(message),
      new Promise<RuntimeResponse>((_, reject) => {
        timeout = globalThis.setTimeout(() => {
          reject(new Error('Firefox background response timed out'));
        }, RUNTIME_MESSAGE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) globalThis.clearTimeout(timeout);
  }
}
