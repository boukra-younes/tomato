import { useEffect, useState } from 'react'
import Modal from './Modal'

function isStandaloneDisplay() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: window-controls-overlay)').matches
    || window.navigator.standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandaloneDisplay())
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const ios = isIos()

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // Some browsers switch display-mode without firing appinstalled reliably —
    // double check on visibility change too.
    const onVisibility = () => { if (isStandaloneDisplay()) setInstalled(true) }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (installed) return null
  if (!deferredPrompt && !ios) return null

  const handleClick = async () => {
    if (ios && !deferredPrompt) {
      setIosHelpOpen(true)
      return
    }
    deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } finally {
      setDeferredPrompt(null)
    }
  }

  return (
    <>
      <button className="btn btn-pill btn-teal" onClick={handleClick}>Install app</button>
      <Modal open={iosHelpOpen} onClose={() => setIosHelpOpen(false)} title="Install this app">
        <p style={{ marginBottom: 12 }}>On iPhone or iPad:</p>
        <ol style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Tap the <b>Share</b> button in Safari's toolbar.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b> in the top right.</li>
        </ol>
      </Modal>
    </>
  )
}
