/* eslint-disable better-tailwindcss/no-unknown-classes */
import { useEffect, useMemo, useState } from 'react';

import type { PendingPicker } from '@/features/background/downloads/picker';

import { sendRuntimeMessage } from '@/library/runtime';

export default function App() {
  const id = useMemo(() => new URLSearchParams(globalThis.location.search).get('id') || '', []);
  const [pending, setPending] = useState<PendingPicker>();
  const [filename, setFilename] = useState('download');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void sendRuntimeMessage({ type: 'picker:get', id }).then((response) => {
      if (!active) return;
      if (!response.ok || !response.result) {
        setError(response.ok ? 'This picker request is no longer available.' : response.message);
        setLoading(false);
        return;
      }
      const value = response.result as PendingPicker;
      setPending(value);
      setFilename(value.input.filename || 'download');
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function submit(): Promise<void> {
    const cleanFilename = filename.trim();
    if (!cleanFilename) {
      setError('Enter a filename before sending the task to Motrix.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await sendRuntimeMessage({
        type: 'picker:submit',
        id,
        filename: cleanFilename,
      });
      if (!response.ok) {
        setError(response.message);
        setBusy(false);
        return;
      }
      closePicker();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  async function cancel(): Promise<void> {
    setBusy(true);
    await sendRuntimeMessage({ type: 'picker:cancel', id }).catch(() => undefined);
    closePicker();
  }

  function closePicker(): void {
    globalThis.close();
  }

  if (loading) return <div className='picker-loading'>Loading Motrix download details…</div>;

  return (
    <main className='picker-shell'>
      <header className='picker-header'>
        <div className='picker-logo' aria-hidden='true'>M</div>
        <div>
          <div className='picker-eyebrow'>MOTRIX DOWNLOAD CONTROL</div>
          <h1>Save with Motrix</h1>
          <p>Review the task like IDM before sending it to the local aria2 service.</p>
        </div>
      </header>

      <section className='picker-card'>
        <div className='picker-card-title'>Download details</div>
        <div className='picker-source'>
          <span className='picker-label'>Source URL</span>
          <span className='picker-url' title={pending?.input.url}>{pending?.input.url || 'Unknown source'}</span>
        </div>
        <label className='picker-label' htmlFor='filename'>File name</label>
        <input
          id='filename'
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
          autoFocus
          spellCheck={false}
        />
      </section>

      {error && <div className='picker-error' role='alert'>{error}</div>}

      <footer className='picker-actions'>
        <button className='button button-secondary' type='button' onClick={() => void cancel()} disabled={busy}>Cancel</button>
        <button className='button button-primary' type='button' onClick={() => void submit()} disabled={busy || !pending}>
          {busy ? 'Sending…' : 'Send to Motrix'}
        </button>
      </footer>
    </main>
  );
}
