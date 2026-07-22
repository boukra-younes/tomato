import { useState } from 'react'
import { Info } from 'lucide-react'

export default function Tooltip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 6 }}>
      <Info
        size={13}
        color="var(--text-secondary)"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
      />
      {show && (
        <span style={{
          position: 'absolute', bottom: '140%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4,
          padding: '8px 10px', fontSize: 12, width: 200, zIndex: 10,
          fontFamily: 'IBM Plex Sans, sans-serif', color: 'var(--text-primary)'
        }}>
          {text}
        </span>
      )}
    </span>
  )
}
