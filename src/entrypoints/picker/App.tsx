/* eslint-disable better-tailwindcss/no-unknown-classes */
import { useEffect, useMemo, useState } from 'react';

import type { PendingPicker } from '@/features/background/downloads/picker';

import { sendRuntimeMessage } from '@/library/runtime';

export default function App() {
  const id = useMemo(() => new URLSearchParams(globalThis.location.search).get('id') || '', []);
  const [pending, setPending] = useState<PendingPicker>();
  const [filename, setFilename] = useState('download');
  const [originalFilename, setOriginalFilename] = useState('download');
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
      const initialFilename = value.input.filename || 'download';
      setFilename(initialFilename);
      setOriginalFilename(initialFilename);
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

  function formatFileSize(value: number | undefined): string {
    if (!value || value <= 0) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
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
          <div className='picker-meta-grid'>
            <div>
              <span className='picker-label'>File size</span>
              <span className='picker-meta-value'>{formatFileSize(pending?.input.fileSize)}</span>
            </div>
            <div>
              <span className='picker-label'>Available sources</span>
              <span className='picker-meta-value'>{pending?.input.candidateUrls?.length || 1}</span>
            </div>
          </div>
          {pending?.input.candidateUrls && pending.input.candidateUrls.length > 1 && (
            <div className='picker-candidates'>
              <span className='picker-label'>Detected media sources</span>
              {pending.input.candidateUrls.slice(0, 5).map((candidate, index) => (
                <span className='picker-candidate' key={`${candidate}-${index}`} title={candidate}>
                  {index + 1}
                  .
                  {candidate}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className='picker-label-row'>
          <label className='picker-label' htmlFor='filename'>File name</label>
          <span className='picker-label-hint' id='filename-hint'>
            {filename.trim() && filename.trim() !== originalFilename.trim() ? 'Renamed for Motrix' : 'Editable before download'}
          </span>
        </div>
        <input
          id='filename'
          name='filename'
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
          aria-describedby='filename-hint'
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
