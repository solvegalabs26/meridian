'use client'

import { useEffect, useRef, useState } from 'react'
import { runIngest } from './actions'
import type { Institution } from './page'
import type { IngestSummary, FailedRow } from '@/lib/enterprise/types'

type Status = 'idle' | 'processing' | 'complete' | 'error'

export default function IngestClient({ institutions }: { institutions: Institution[] }) {
  const [selectedId, setSelectedId] = useState(institutions[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<IngestSummary | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [failedOpen, setFailedOpen] = useState(false)
  const [copyDone, setCopyDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedInstitution = institutions.find(i => i.id === selectedId)
  const dpaSigned = !!selectedInstitution?.dpa_signed_at
  const canSubmit = !!file && dpaSigned && status !== 'processing' && !fileError

  // Elapsed timer during processing
  useEffect(() => {
    if (status === 'processing') {
      setElapsed(0)
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [status])

  function validateAndSetFile(f: File | null) {
    if (!f) { setFile(null); setFileError(null); return }
    if (!f.name.endsWith('.csv') && f.type !== 'text/csv') {
      setFile(null)
      setFileError('Only .csv files are accepted')
      return
    }
    setFile(f)
    setFileError(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    validateAndSetFile(e.dataTransfer.files[0] ?? null)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndSetFile(e.target.files?.[0] ?? null)
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }

  function reset() {
    setFile(null)
    setFileError(null)
    setStatus('idle')
    setElapsed(0)
    setFailedOpen(false)
    setCopyDone(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!file || !selectedId) return
    setStatus('processing')
    setResult(null)
    setErrorMsg(null)
    setFailedOpen(false)

    const fd = new FormData()
    fd.append('institution_id', selectedId)
    fd.append('file', file)

    try {
      const summary = await runIngest(fd)
      setResult(summary)
      setStatus('complete')
      if ((summary.failed ?? 0) > 0) setFailedOpen(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      const isTimeout = msg.includes('504') || msg.toLowerCase().includes('timeout')
      setErrorMsg(
        isTimeout
          ? 'Ingest failed. The portfolio may be very large — check Supabase for partial writes before retrying.'
          : msg
      )
      setStatus('error')
    }
  }

  function buildCorrectionReport() {
    const date = new Date().toISOString().split('T')[0]
    const name = selectedInstitution?.name ?? 'Unknown Institution'
    const lines = [
      'Meridian Fusion — Ingestion Correction Report',
      `Institution: ${name}`,
      `Date: ${date}`,
      `Rows requiring correction: ${result?.failed ?? 0}`,
      '',
      ...(result?.failed_rows ?? []).map((r: FailedRow) =>
        `Row ${String(r.row_number).padEnd(5)} | ${(r.case_ref ?? '—').padEnd(12)} | ${r.reason}`
      ),
    ]
    return lines.join('\n')
  }

  async function copyReport() {
    await navigator.clipboard.writeText(buildCorrectionReport())
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  const isProcessing = status === 'processing'
  const isComplete = status === 'complete'
  const isError = status === 'error'

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Upload card ── */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 space-y-5">

        {/* Institution picker */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text3)] mb-2">
            Institution
          </label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            disabled={isProcessing}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)] disabled:opacity-50"
          >
            {institutions.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.name} — {inst.slug}
              </option>
            ))}
          </select>

          {/* DPA status */}
          <div className="flex items-center gap-2 mt-2">
            {dpaSigned ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--green)] inline-block" />
                <span className="text-[12px] text-[var(--green)]">DPA signed</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--amber)] inline-block" />
                <span className="text-[12px] text-[var(--amber)]">DPA not signed — data blocked</span>
              </>
            )}
          </div>

          {!dpaSigned && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--amber-lt)] text-[12px] text-[var(--amber)]">
              Data processing agreement required before ingestion.
            </div>
          )}
        </div>

        {/* File drop zone */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text3)] mb-2">
            CSV File
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={[
              'relative border-2 border-dashed rounded-xl px-6 py-8 text-center transition-colors',
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              isDragging
                ? 'border-[var(--gold)] bg-[#fdf8ed]'
                : file
                ? 'border-[var(--green)] bg-[var(--green-lt)]'
                : 'border-[var(--border)] hover:border-[var(--text3)]',
            ].join(' ')}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
              disabled={isProcessing}
            />
            {file ? (
              <div className="space-y-1">
                <p className="text-[13px] font-medium text-[var(--green)]">✓ {file.name}</p>
                <p className="text-[11px] text-[var(--text3)]">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[13px] text-[var(--text3)]">Drop CSV here or click to browse</p>
                <p className="text-[11px] text-[var(--text3)] opacity-60">.csv files only</p>
              </div>
            )}
          </div>
          {fileError && (
            <p className="mt-2 text-[12px] text-[var(--red)]">{fileError}</p>
          )}
        </div>

        {/* Submit button */}
        <div className="pt-1">
          {isComplete || isError ? (
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-lg text-[13px] font-semibold bg-white border border-[var(--border)] text-[var(--text2)] hover:border-[var(--text3)] transition-colors"
            >
              Ingest Another
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={[
                'px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2',
                canSubmit
                  ? 'bg-[var(--gold)] text-white hover:opacity-90'
                  : 'bg-[var(--gray-lt)] text-[var(--text3)] cursor-not-allowed',
              ].join(' ')}
            >
              {isProcessing ? (
                <>
                  <Spinner />
                  Ingesting… {elapsed}s
                </>
              ) : (
                'Ingest Portfolio'
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Error state ── */}
      {isError && errorMsg && (
        <div className="rounded-xl border border-[var(--red)] bg-[var(--red-lt)] px-5 py-4">
          <p className="text-[12px] font-semibold text-[var(--red)] uppercase tracking-wide mb-1">Ingest Failed</p>
          <p className="text-[13px] text-[var(--red)]">{errorMsg}</p>
        </div>
      )}

      {/* ── Results panel ── */}
      {isComplete && result && (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">

          {/* Stat tiles */}
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)]">
            <StatTile
              value={result.ingested}
              label="rows written"
              color={result.ingested === 0 && result.failed > 0 ? 'red' : 'green'}
            />
            <StatTile
              value={result.failed}
              label="rows rejected"
              color={result.failed === 0 ? 'neutral' : 'red'}
            />
            <StatTile
              value={`${(result.duration_ms / 1000).toFixed(1)}s`}
              label="processing time"
              color="neutral"
            />
          </div>

          {/* Success / zero-failure state */}
          {result.failed === 0 && result.ingested === 0 && (
            <div className="px-6 py-4">
              <p className="text-[13px] text-[var(--text3)]">No data rows found in the file.</p>
            </div>
          )}

          {result.failed === 0 && result.ingested > 0 && (
            <div className="px-6 py-4">
              <p className="text-[13px] text-[var(--green)]">
                All rows ingested successfully. Run a sweep to generate intelligence briefings.
              </p>
            </div>
          )}

          {/* All rows failed banner */}
          {result.failed > 0 && result.ingested === 0 && (
            <div className="px-6 py-3 bg-[var(--red-lt)] border-b border-[var(--border)]">
              <p className="text-[12px] text-[var(--red)] font-medium">
                0 rows written. All rows were rejected — check the correction report.
              </p>
            </div>
          )}

          {/* Failed rows collapsible */}
          {result.failed > 0 && (
            <div>
              <button
                onClick={() => setFailedOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-[var(--gray-lt)] transition-colors"
              >
                <span className="text-[13px] font-medium text-[var(--text)]">
                  {result.failed} row{result.failed !== 1 ? 's' : ''} need correction
                </span>
                <ChevronIcon open={failedOpen} />
              </button>

              {failedOpen && (
                <div className="border-t border-[var(--border)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[var(--gray-lt)]">
                          <th className="text-left px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] w-16">Row</th>
                          <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)] w-36">Case Ref</th>
                          <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text3)]">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.failed_rows.map((r, i) => (
                          <tr key={i} className="border-t border-[var(--border)]">
                            <td className="px-6 py-2 text-[var(--text3)]">{r.row_number}</td>
                            <td className="px-4 py-2 font-mono text-[var(--text)]">{r.case_ref ?? '—'}</td>
                            <td className="px-4 py-2 text-[var(--text2)]">{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-3 border-t border-[var(--border)]">
                    <button
                      onClick={copyReport}
                      className="text-[12px] font-medium text-[var(--blue)] hover:opacity-80 transition-opacity flex items-center gap-1.5"
                    >
                      {copyDone ? '✓ Copied' : 'Copy correction report'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatTile({ value, label, color }: { value: string | number; label: string; color: 'green' | 'red' | 'neutral' }) {
  const valueColor =
    color === 'green' ? 'text-[var(--green)]' :
    color === 'red'   ? 'text-[var(--red)]' :
    'text-[var(--text)]'

  return (
    <div className="px-6 py-5">
      <p className={`text-[28px] font-medium leading-none ${valueColor}`}>{value}</p>
      <p className="text-[11px] text-[var(--text3)] mt-1">{label}</p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-[var(--text3)] transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}
