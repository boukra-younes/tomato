export default function ProgressBar({ label, value, max, unit, color = 'var(--teal)' }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0)
  const over = max && value > max
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="eyebrow">{label}</span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: over ? 'var(--sienna)' : 'var(--text-secondary)' }}>
          {Math.round(value)} / {Math.round(max)} {unit}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: over ? 'var(--sienna)' : color,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}
