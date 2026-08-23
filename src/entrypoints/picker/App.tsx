/* eslint-disable better-tailwindcss/no-unknown-classes */

import { useEffect, useMemo, useState } from 'react';

import type { MediaCandidate } from '@/library/rpc';
import type { PendingPicker } from '@/features/background/downloads/picker';

import { sendRuntimeMessage } from '@/library/runtime';
import { filenameFromUrl } from '@/library/download/filename-metadata';

interface PickerCandidate extends MediaCandidate {
  name: string;
  order: number;
}

type CandidateSort = 'size' | 'name';

export default function App() {
  const id = useMemo(() => new URLSearchParams(globalThis.location.search).get('id') || '', []);
  const [pending, setPending] = useState<PendingPicker>();
  const [filename, setFilename] = useState('download');
  const [originalFilename, setOriginalFilename] = useState('download');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [candidateSort, setCandidateSort] = useState<CandidateSort>('size');
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
      const candidates = getPickerCandidates(value);
      setPending(value);
      setSelectedUrl(candidates[0]?.url || value.input.url);
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

  const candidates = useMemo(() => getPickerCandidates(pending), [pending]);
  const sortedCandidates = useMemo(
    () => sortCandidates(candidates, candidateSort),
    [candidateSort, candidates],
  );
  const selectedCandidate = candidates.find((candidate) => candidate.url === selectedUrl) || candidates[0];
  const selectedSourceUrl = selectedCandidate?.url || pending?.input.url || '';
  const selectedFileSize = selectedCandidate?.fileSize ?? pending?.input.fileSize;

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
        selectedUrl: selectedCandidate?.url,
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
          <span className='picker-label'>Selected media URL</span>
          <span className='picker-url' title={selectedSourceUrl}>{selectedSourceUrl || 'Unknown source'}</span>
          <div className='picker-meta-grid'>
            <div>
              <span className='picker-label'>File size</span>
              <span className='picker-meta-value'>{formatFileSize(selectedFileSize)}</span>
            </div>
            <div>
              <span className='picker-label'>Available sources</span>
              <span className='picker-meta-value'>{candidates.length || 1}</span>
            </div>
          </div>
          {candidates.length > 1 && (
            <div className='picker-candidates'>
              <div className='picker-candidate-toolbar'>
                <span className='picker-label'>Available media</span>
                <label className='picker-sort-label'>
                  <span>Sort</span>
                  <select
                    aria-label='Sort available media'
                    value={candidateSort}
                    onChange={(event) => setCandidateSort(event.target.value as CandidateSort)}
                  >
                    <option value='size'>Size</option>
                    <option value='name'>Name</option>
                  </select>
                </label>
              </div>
              <select
                className='picker-candidate-select'
                aria-label='Select media source'
                value={selectedCandidate?.url || ''}
                onChange={(event) => setSelectedUrl(event.target.value)}
              >
                {sortedCandidates.map((candidate) => (
                  <option key={candidate.url} value={candidate.url}>
                    {candidate.name}
                    {' '}
                    ·
                    {formatFileSize(candidate.fileSize)}
                  </option>
                ))}
              </select>
              <span className='picker-candidate-selection' title={selectedCandidate?.url}>
                Selected:
                {' '}
                {selectedCandidate?.name || 'Media source'}
                {' '}
                ·
                {' '}
                {formatFileSize(selectedFileSize)}
              </span>
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

function getPickerCandidates(pending: PendingPicker | undefined): PickerCandidate[] {
  if (!pending) return [];
  const structured = pending.input.mediaCandidates || [];
  const candidates = structured.length
    ? structured
    : (pending.input.candidateUrls || [pending.input.url]).map((url): MediaCandidate => ({
        url,
        fileSize: url === pending.input.url ? pending.input.fileSize : undefined,
      }));
  return candidates
    .filter(
      (candidate, index, values) => candidate.url && values.findIndex((value) => value.url === candidate.url) === index,
    )
    .map((candidate, order) => ({
      ...candidate,
      name: candidate.filename || filenameFromUrl(candidate.url) || 'Media source',
      order,
    }));
}

function sortCandidates(candidates: PickerCandidate[], sort: CandidateSort): PickerCandidate[] {
  return [...candidates].sort((left, right) => {
    const comparison = sort === 'name'
      ? left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
      : compareFileSize(left.fileSize, right.fileSize);
    return comparison || left.order - right.order;
  });
}

function compareFileSize(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return right - left;
}
