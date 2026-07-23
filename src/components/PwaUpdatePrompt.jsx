import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {})
      }, 60 * 60 * 1000)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    }
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div
      className="pwa-toast"
      style={{
        position: 'fixed', left: 16, right: 16, zIndex: 200,
        maxWidth: 420, margin: '0 auto',
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
        padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
      }}
    >
      {needRefresh ? (
        <>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, marginBottom: 6 }}>Update available</div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>A new version is ready. Refresh to update — your data is unaffected.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>Refresh now</button>
            <button className="btn btn-secondary" onClick={close}>Later</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, marginBottom: 6 }}>Ready to work offline</div>
          <div className="eyebrow" style={{ marginBottom: 14 }}>The app is now cached and available without a connection.</div>
          <button className="btn btn-secondary" onClick={close}>Dismiss</button>
        </>
      )}
    </div>
  )
}
