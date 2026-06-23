'use client'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h2 style={{ color: 'red' }}>App Error</h2>
      <pre style={{ background: '#f0f0f0', padding: '1rem', overflow: 'auto' }}>
        {error.message}
        {'\n'}
        {error.stack}
        {'\n'}
        digest: {error.digest}
      </pre>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
