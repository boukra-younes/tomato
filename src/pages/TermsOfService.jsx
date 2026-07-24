import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <div className="app-shell" style={{ maxWidth: 720, paddingTop: 60 }}>
      <div className="eyebrow">Healthy Tomato</div>
      <h1 className="hero-number" style={{ fontSize: 40 }}>Terms of Service</h1>
      <div className="eyebrow" style={{ marginBottom: 24 }}>Last updated July 24, 2026</div>

      <div className="card" style={{ lineHeight: 1.7, fontSize: 14 }}>
        <p>
          These Terms of Service ("Terms") govern your use of Healthy Tomato ("the App", "we",
          "us"). By creating an account or using the App, you agree to these Terms.
        </p>

        <h3>1. The service</h3>
        <p>
          The App lets you log food, exercise, and body measurements, view nutrition and calorie
          totals, sync step counts from Google Fit, and search a database of foods that is
          supplemented with AI-estimated nutrition data (via Google Gemini) and Open Food Facts
          when a food isn't already known.
        </p>

        <h3>2. Not medical advice</h3>
        <p>
          The App is a personal tracking tool, not a medical device or service. Calorie, macro,
          and micronutrient figures — including AI-estimated values — are approximations and may
          be inaccurate. Nothing in the App constitutes medical, dietary, or health advice. Consult
          a qualified professional before making decisions about your diet, exercise, or health
          based on information from the App.
        </p>

        <h3>3. Your account</h3>
        <p>
          You are responsible for the accuracy of the information you provide and for keeping your
          account credentials confidential. You must be at least 13 years old to use the App.
        </p>

        <h3>4. Acceptable use</h3>
        <p>
          You agree not to misuse the App — including attempting to disrupt its operation, access
          another user's data, or use it for any unlawful purpose.
        </p>

        <h3>5. Third-party services</h3>
        <p>
          The App integrates with Google Fit, Google Gemini, Open Food Facts, and Supabase to
          provide its features. Your use of those integrations is also subject to each provider's
          own terms. We are not responsible for the availability or accuracy of third-party
          services.
        </p>

        <h3>6. Data &amp; privacy</h3>
        <p>
          Our <Link to="/privacy">Privacy Policy</Link> explains what data we collect and how it
          is used and shared. It is part of these Terms.
        </p>

        <h3>7. Disclaimers &amp; limitation of liability</h3>
        <p>
          The App is provided "as is" without warranties of any kind. To the fullest extent
          permitted by law, we are not liable for any damages arising from your use of the App,
          including reliance on estimated nutrition or calorie data.
        </p>

        <h3>8. Termination</h3>
        <p>
          You may stop using the App and request account deletion at any time. We may suspend or
          terminate accounts that violate these Terms.
        </p>

        <h3>9. Changes to these Terms</h3>
        <p>
          We may update these Terms from time to time. Continued use of the App after a change
          means you accept the updated Terms.
        </p>

        <h3>10. Contact</h3>
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:red.mounir.rabahi@gmail.com">red.mounir.rabahi@gmail.com</a>.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link to="/privacy" className="btn btn-secondary btn-pill">Privacy Policy</Link>
      </div>
    </div>
  )
}
