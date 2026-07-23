// =========================================================================
// googleFit.js
// Browser-only Google Fit step-count integration.
// Uses Google Identity Services (GIS) for an OAuth2 access token (no
// backend, no client secret) then calls the Fitness REST API directly
// with fetch(). Token lives in memory only for the current session.
// =========================================================================

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || null
const SCOPES = 'https://www.googleapis.com/auth/fitness.activity.read'

let gisLoaded = false
let tokenClient = null
let currentAccessToken = null
let tokenExpiresAt = 0

export function isGoogleFitConfigured() {
  return !!CLIENT_ID
}

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (gisLoaded && window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.getElementById('gis-client-script')
    if (existing) {
      existing.addEventListener('load', () => { gisLoaded = true; resolve() })
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = 'gis-client-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => { gisLoaded = true; resolve() }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

/**
 * connectGoogleFit — opens the Google consent popup and resolves with a
 * short-lived access token. Never throws to the caller for user-dismissed
 * popups; rejects with an Error for genuine failures instead.
 */
export async function connectGoogleFit() {
  if (!CLIENT_ID) {
    throw new Error('Google Fit is not configured (missing VITE_GOOGLE_CLIENT_ID).')
  }
  await loadGisScript()

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error))
            return
          }
          currentAccessToken = response.access_token
          tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000
          resolve(currentAccessToken)
        }
      })
      tokenClient.requestAccessToken({ prompt: currentAccessToken ? '' : 'consent' })
    } catch (err) {
      reject(err)
    }
  })
}

export function isGoogleFitConnected() {
  return !!currentAccessToken && Date.now() < tokenExpiresAt
}

export function disconnectGoogleFit() {
  if (currentAccessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(currentAccessToken, () => {})
  }
  currentAccessToken = null
  tokenExpiresAt = 0
}

/**
 * fetchStepsForDate — aggregates step_count.delta for a single local day
 * via the Fitness REST API. Returns an integer step count (0 if none).
 */
export async function fetchStepsForDate(dateStr) {
  if (!isGoogleFitConnected()) {
    throw new Error('Google Fit is not connected.')
  }
  const start = new Date(dateStr)
  start.setHours(0, 0, 0, 0)
  const end = new Date(dateStr)
  end.setHours(23, 59, 59, 999)

  const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${currentAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: start.getTime(),
      endTimeMillis: end.getTime()
    })
  })

  if (!res.ok) {
    throw new Error(`Google Fit request failed (${res.status})`)
  }

  const data = await res.json()
  let steps = 0
  for (const bucket of data.bucket || []) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const value of point.value || []) {
          steps += value.intVal || 0
        }
      }
    }
  }
  return steps
}

/**
 * fetchStepsRange — same as fetchStepsForDate but for a start/end date
 * range, returned as [{ date: 'yyyy-MM-dd', steps }] one entry per day.
 */
export async function fetchStepsRange(startDateStr, endDateStr) {
  if (!isGoogleFitConnected()) {
    throw new Error('Google Fit is not connected.')
  }
  const start = new Date(startDateStr)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDateStr)
  end.setHours(23, 59, 59, 999)

  const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${currentAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: start.getTime(),
      endTimeMillis: end.getTime()
    })
  })

  if (!res.ok) {
    throw new Error(`Google Fit request failed (${res.status})`)
  }

  const data = await res.json()
  return (data.bucket || []).map(bucket => {
    let steps = 0
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const value of point.value || []) {
          steps += value.intVal || 0
        }
      }
    }
    const date = new Date(Number(bucket.startTimeMillis)).toISOString().slice(0, 10)
    return { date, steps }
  })
}
