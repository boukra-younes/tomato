// =========================================================================
// googleFit.js
// Google Fit step-count integration. Linking still starts in the browser
// (Google Identity Services), but the resulting refresh token is
// exchanged and stored server-side via the google-fit-auth Edge Function
// — never in this browser alone — so the connection survives reloads and
// follows the user's account across devices. Only short-lived access
// tokens ever live in memory here.
// =========================================================================

import { supabase } from "./supabaseClient";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
const SCOPES = 'https://www.googleapis.com/auth/fitness.activity.read';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || null;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || null;

let gisLoaded = false;
let currentAccessToken = null;
let tokenExpiresAt = 0;
let refreshTimer = null;

const LINKED_STORAGE_KEY = 'googleFitLinked';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function isGoogleFitConfigured() {
  return !!CLIENT_ID && !!SUPABASE_URL;
}

/**
 * wasGoogleFitLinked — a fast local hint (this browser previously linked
 * successfully) used only to avoid a UI flash before the real,
 * server-backed check (tryRestoreGoogleFitSession) resolves. Never the
 * source of truth — a brand new device with no local flag still gets
 * correctly detected as linked via the server.
 */
export function wasGoogleFitLinked() {
  return typeof window !== 'undefined' && localStorage.getItem(LINKED_STORAGE_KEY) === '1';
}

function markLinked(linked) {
  if (typeof window === 'undefined') return;
  if (linked) localStorage.setItem(LINKED_STORAGE_KEY, '1');
  else localStorage.removeItem(LINKED_STORAGE_KEY);
}

function scheduleSilentRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(tokenExpiresAt - Date.now() - REFRESH_MARGIN_MS, 30 * 1000);
  refreshTimer = setTimeout(() => { tryRestoreGoogleFitSession(); }, delay);
}

function clearSilentRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (gisLoaded && window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById('gis-client-script');
    if (existing) {
      existing.addEventListener('load', () => { gisLoaded = true; resolve(); });
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gis-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * callGoogleFitAuth — talks to the google-fit-auth Edge Function, which
 * holds the Google client secret and the stored refresh token. Requires
 * the caller to be signed in to this app (its Supabase session is what
 * ties the Google Fit link to a specific account, not to a browser).
 */
async function callGoogleFitAuth(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in.');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-fit-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Google Fit request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/**
 * connectGoogleFit — opens the Google consent popup requesting offline
 * access, exchanges the resulting authorization code for tokens via the
 * Edge Function (which stores the refresh token server-side), and
 * resolves with a short-lived access token ready to use immediately.
 */
export async function connectGoogleFit() {
  if (!isGoogleFitConfigured()) {
    throw new Error('Google Fit is not configured (missing VITE_GOOGLE_CLIENT_ID or Supabase config).');
  }
  await loadGisScript();

  const code = await new Promise((resolve, reject) => {
    try {
      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        ux_mode: 'popup',
        access_type: 'offline',
        prompt: 'consent',
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response.code);
        },
      });
      codeClient.requestCode();
    } catch (err) {
      reject(err);
    }
  });

  const result = await callGoogleFitAuth('exchange', { code });
  currentAccessToken = result.access_token;
  tokenExpiresAt = Date.now() + (result.expires_in || 3600) * 1000;
  markLinked(true);
  scheduleSilentRefresh();
  return currentAccessToken;
}

export function isGoogleFitConnected() {
  return !!currentAccessToken && Date.now() < tokenExpiresAt;
}

export async function disconnectGoogleFit() {
  clearSilentRefresh();
  try {
    await callGoogleFitAuth('disconnect');
  } catch {
    // best-effort — clear local state regardless
  }
  currentAccessToken = null;
  tokenExpiresAt = 0;
  markLinked(false);
}

/**
 * tryRestoreGoogleFitSession — mints a fresh access token from the
 * server-stored refresh token, with no Google popup and no dependency on
 * this browser's history. Safe to call on every page load (and on a
 * timer before the current token expires): it simply reports "not
 * linked" if the signed-in account has never connected Google Fit, and
 * re-arms its own refresh loop on success.
 */
export async function tryRestoreGoogleFitSession() {
  if (!isGoogleFitConfigured()) return false;
  if (isGoogleFitConnected()) {
    scheduleSilentRefresh();
    return true;
  }
  try {
    const result = await callGoogleFitAuth('refresh');
    currentAccessToken = result.access_token;
    tokenExpiresAt = Date.now() + (result.expires_in || 3600) * 1000;
    markLinked(true);
    scheduleSilentRefresh();
    return true;
  } catch (err) {
    if (err.status === 401 && err.payload?.revoked) markLinked(false);
    if (err.status === 404) markLinked(false);
    return false;
  }
}

/**
 * fetchStepsForDate — aggregates step_count.delta for a single local day
 * via the Fitness REST API. Returns an integer step count (0 if none).
 */
export async function fetchStepsForDate(dateStr) {
  if (!isGoogleFitConnected()) {
    throw new Error('Google Fit is not connected.');
  }
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);

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
  });

  if (!res.ok) {
    throw new Error(`Google Fit request failed (${res.status})`);
  }

  const data = await res.json();
  let steps = 0;
  for (const bucket of data.bucket || []) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const value of point.value || []) {
          steps += value.intVal || 0;
        }
      }
    }
  }
  return steps;
}

/**
 * fetchStepsRange — same as fetchStepsForDate but for a start/end date
 * range, returned as [{ date: 'yyyy-MM-dd', steps }] one entry per day.
 */
export async function fetchStepsRange(startDateStr, endDateStr) {
  if (!isGoogleFitConnected()) {
    throw new Error('Google Fit is not connected.');
  }
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(23, 59, 59, 999);

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
  });

  if (!res.ok) {
    throw new Error(`Google Fit request failed (${res.status})`);
  }

  const data = await res.json();
  return (data.bucket || []).map(bucket => {
    let steps = 0;
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const value of point.value || []) {
          steps += value.intVal || 0;
        }
      }
    }
    const date = new Date(Number(bucket.startTimeMillis)).toISOString().slice(0, 10);
    return { date, steps };
  });
}

const WALKING_MET = 3.5;
const AVERAGE_STEPS_PER_MINUTE = 100;

/**
 * estimateStepsCalories — auto-calculates calories burned from a step
 * count using the same MET formula (calories = MET x weight(kg) x
 * duration(hours)) the rest of the app already uses for logged workouts,
 * with duration derived from an average walking cadence of 100 steps/min.
 * For 10,000 steps at 75kg this comes out to ~440 kcal, in line with
 * typical fitness-tracker estimates.
 */
export function estimateStepsCalories(steps, weightKg = 75) {
  const count = Number(steps) || 0;
  if (!count) return 0;
  const durationHours = count / AVERAGE_STEPS_PER_MINUTE / 60;
  return Math.round(WALKING_MET * weightKg * durationHours);
}
