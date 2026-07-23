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
let refreshTimer = null

const LINKED_STORAGE_KEY = 'googleFitLinked'
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export function isGoogleFitConfigured() {
  return !!CLIENT_ID
}

/**
 * wasGoogleFitLinked — true if the user previously granted Google Fit
 * consent on this browser. The in-memory access token never survives a
 * page reload, so this flag is what lets us attempt a silent
 * reconnect (tryRestoreGoogleFitSession) instead of forcing the user to
 * click "Connect" again every time they open the app.
 */
export function wasGoogleFitLinked() {
  return typeof window !== 'undefined' && localStorage.getItem(LINKED_STORAGE_KEY) === '1'
}

function markLinked(linked) {
  if (typeof window === 'undefined') return
  if (linked) localStorage.setItem(LINKED_STORAGE_KEY, '1')
  else localStorage.removeItem(LINKED_STORAGE_KEY)
}

/**
 * scheduleSilentRefresh — as long as the tab stays open, silently
 * re-requests a token a few minutes before the current one expires, so
 * the connection never visibly drops out from under the user just from
 * the ~1hr GIS access token lifetime. Re-arms itself after every
 * successful refresh; gives up (leaving "Connect Google Fit" as the
 * fallback) only if a refresh attempt genuinely fails.
 */
function scheduleSilentRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  const delay = Math.max(tokenExpiresAt - Date.now() - REFRESH_MARGIN_MS, 30 * 1000)
  refreshTimer = setTimeout(() => {
    tryRestoreGoogleFitSession()
  }, delay)
}

function clearSilentRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
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
          markLinked(true)
          scheduleSilentRefresh()
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
  markLinked(false)
  clearSilentRefresh()
}

/**
 * tryRestoreGoogleFitSession — called once per page load. If the user
 * previously linked Google Fit on this browser, silently requests a fresh
 * access token (no visible consent screen when the grant is still valid)
 * so the connection survives a reload instead of requiring the user to
 * click "Connect" again. Resolves false (never throws) if silent reauth
 * isn't possible, leaving the "Connect Google Fit" button as the fallback.
 */
export async function tryRestoreGoogleFitSession() {
  if (!CLIENT_ID || !wasGoogleFitLinked()) return false
  if (isGoogleFitConnected()) {
    scheduleSilentRefresh()
    return true
  }
  try {
    await loadGisScript()
  } catch {
    return false
  }

  return new Promise((resolve) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            // A silent refresh can legitimately fail (offline, third-party
            // cookies blocked, brief Google-side hiccup) without the user
            // having revoked access — don't unlink on that. scheduleSilentRefresh
            // isn't re-armed here, but the next full page load or manual
            // "Connect" retries the same silent flow.
            resolve(false)
            return
          }
          currentAccessToken = response.access_token
          tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000
          scheduleSilentRefresh()
          resolve(true)
        }
      })
      tokenClient.requestAccessToken({ prompt: '' })
    } catch {
      resolve(false)
    }
  })
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

const WALKING_MET = 3.5
const AVERAGE_STEPS_PER_MINUTE = 100

/**
 * estimateStepsCalories — auto-calculates calories burned from a step
 * count using the same MET formula (calories = MET x weight(kg) x
 * duration(hours)) the rest of the app already uses for logged workouts,
 * with duration derived from an average walking cadence of 100 steps/min.
 * For 10,000 steps at 75kg this comes out to ~440 kcal, in line with
 * typical fitness-tracker estimates.
 */
export function estimateStepsCalories(steps, weightKg = 75) {
  const count = Number(steps) || 0
  if (!count) return 0
  const durationHours = count / AVERAGE_STEPS_PER_MINUTE / 60
  return Math.round(WALKING_MET * weightKg * durationHours)
}
