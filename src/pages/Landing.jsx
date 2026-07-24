import { Link } from 'react-router-dom'

const FEATURES = [
  { title: 'Food & nutrition tracking', body: 'Log meals with full macro and micronutrient breakdowns, backed by a curated + AI-assisted food database and Open Food Facts for packaged products.' },
  { title: 'Exercise & workouts', body: 'Log strength workouts and cardio, with calorie burn calculated from your logged sets and duration.' },
  { title: 'Google Fit step sync', body: 'Connect Google Fit to automatically pull in your daily step count and estimated calories burned from walking.' },
  { title: 'Body & health tracking', body: 'Track weight trends, body measurements, water, caffeine, and alcohol intake alongside your nutrition data.' },
  { title: 'Plans & goals', body: 'Set calorie and macro targets and see how each day tracks against them.' },
  { title: 'Reports & progress', body: 'Review historical trends across nutrition, weight, and exercise over time.' },
]

export default function Landing() {
  return (
    <div className="app-shell" style={{ paddingTop: 60 }}>
      <div className="eyebrow">Healthy Tomato</div>
      <h1 className="hero-number" style={{ fontSize: 52 }}>Nutrition, exercise, and body tracking in one place.</h1>
      <p style={{ maxWidth: 620, fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', marginTop: 8 }}>
        Healthy Tomato is a personal health tracking app: log what you eat and how you move, sync
        your steps from Google Fit, and see your calorie, macro, and micronutrient totals against
        your own goals — all in one dashboard.
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 40, flexWrap: 'wrap' }}>
        <Link to="/auth" className="btn btn-primary">Sign in / Create account</Link>
        <Link to="/privacy" className="btn btn-secondary">Privacy Policy</Link>
        <Link to="/terms" className="btn btn-secondary">Terms of Service</Link>
      </div>

      <div className="grid-3">
        {FEATURES.map(f => (
          <div key={f.title} className="card">
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
            <div className="eyebrow" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5, lineHeight: 1.6 }}>{f.body}</div>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{ marginTop: 40 }}>
        Questions? Contact <a href="mailto:red.mounir.rabahi@gmail.com">red.mounir.rabahi@gmail.com</a>
      </div>
    </div>
  )
}
