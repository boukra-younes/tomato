export default function Ring({ value, max, label, unit, color = 'var(--teal)', size = 108, dotColor }) {
  const pct = Math.min(1, max ? value / max : 0)
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div className="ring-wrap">
      {dotColor && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'block' }} />}
      <svg width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
        <text x="50%" y="54%" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="600" fontSize={size * 0.24} fill="var(--text-primary)">
          {Math.round(value)}
        </text>
      </svg>
      <div className="eyebrow" style={{ marginTop: -6 }}>{unit}</div>
      <div className="eyebrow" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  )
}
