import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="app-shell" style={{ maxWidth: 720, paddingTop: 60 }}>
      <div className="eyebrow">Healthy Tomato</div>
      <h1 className="hero-number" style={{ fontSize: 40 }}>Privacy Policy</h1>
      <div className="eyebrow" style={{ marginBottom: 24 }}>Last updated July 24, 2026</div>

      <div className="card" style={{ lineHeight: 1.7, fontSize: 14 }}>
        <p>
          This Privacy Policy explains what information Healthy Tomato ("the App", "we", "us")
          collects, how it is used, and who it is shared with. By using the App you agree to the
          practices described here.
        </p>

        <h3>1. Information we collect</h3>
        <ul>
          <li><b>Account information</b> — the email address and name you sign up with.</li>
          <li>
            <b>Health &amp; fitness data you enter</b> — food and nutrient logs, exercise and
            workout sessions, body measurements, water/caffeine/alcohol logs, and daily step
            counts.
          </li>
          <li>
            <b>Google Fit step data</b> — if you connect Google Fit, we read your daily step
            count via Google's Fitness API. We request only the
            <code> fitness.activity.read </code> scope and never write to your Google account.
          </li>
          <li>
            <b>Search queries</b> — food names you search for, used to look up nutrition
            information (see Section 3).
          </li>
        </ul>

        <h3>2. How we use your information</h3>
        <p>
          We use your data solely to provide the App's features: showing your logged nutrition
          and exercise history, calculating calorie/macro/micronutrient totals, syncing step
          counts, and estimating nutrition for foods not already in our database.
        </p>
        <p>We do not sell your personal data, and we do not use it for advertising.</p>

        <h3>3. Third-party services</h3>
        <p>The App relies on the following third-party services to function:</p>
        <ul>
          <li>
            <b>Supabase</b> — hosts our database and authentication. Your account and logged data
            are stored there, protected by row-level security so only you can read or write your
            own records.
          </li>
          <li>
            <b>Google Fit / Google OAuth</b> — if you choose to connect it, your Google Fit step
            data is retrieved through Google's Fitness API. The OAuth refresh token used to
            maintain this connection is stored server-side (never in your browser) and is used
            only to keep your Google Fit link active across sessions and devices. You can
            disconnect at any time from the Exercise page, which deletes this token and revokes
            access with Google.
          </li>
          <li>
            <b>Google Gemini API</b> — when a food you search for isn't already in our database,
            the search text is sent to Google's Gemini API to estimate its nutrition profile. No
            account information is included in this request — only the food name you typed.
          </li>
          <li>
            <b>Open Food Facts</b> — an open, public food database used to look up packaged and
            branded products by name or barcode. Only the search text or barcode is sent; no
            account information is included.
          </li>
        </ul>

        <h3>4. Data storage &amp; security</h3>
        <p>
          Your data is stored in a Supabase Postgres database with row-level security enabled, so
          each user's records are isolated and accessible only to that user. Secrets such as the
          Google Fit refresh token and third-party API keys are never exposed to the browser.
        </p>

        <h3>5. Data retention &amp; deletion</h3>
        <p>
          We retain your data for as long as your account is active. You can request deletion of
          your account and all associated data at any time by contacting us using the details
          below; we will delete it within a reasonable time.
        </p>

        <h3>6. Children's privacy</h3>
        <p>The App is not directed at children under 13 and we do not knowingly collect data from them.</p>

        <h3>7. Changes to this policy</h3>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected
          by updating the "Last updated" date above.
        </p>

        <h3>8. Contact</h3>
        <p>
          Questions about this policy or your data can be sent to{' '}
          <a href="mailto:red.mounir.rabahi@gmail.com">red.mounir.rabahi@gmail.com</a>.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link to="/terms" className="btn btn-secondary btn-pill">Terms of Service</Link>
      </div>
    </div>
  )
}
