import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeficitStore } from '../context/useDeficitStore'
import { ageFromBirthDate } from '../lib/calculations'
import Modal from './Modal'
import PlanEditor from './PlanEditor'
import toast from 'react-hot-toast'

export default function Header() {
  const { profile, updateProfile } = useAuth()
  const { planSummary } = useDeficitStore()
  const [editPlanOpen, setEditPlanOpen] = useState(false)
  const [changeCodeOpen, setChangeCodeOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(profile?.plan_name || 'Sustained energy deficit')

  const age = profile?.birth_date ? ageFromBirthDate(profile.birth_date) : null
  const activityLabel = {
    sedentary: 'Sedentary', light: 'Light', moderate: 'Moderate', active: 'Active', very_active: 'Very active'
  }[profile?.activity_level] || 'Sedentary'

  const saveName = async () => {
    await updateProfile({ plan_name: nameDraft })
    setEditingName(false)
  }

  const changeSyncCode = async () => {
    if (!newCode || newCode.length < 3) { toast.error('Code must be at least 3 characters'); return }
    try {
      await updateProfile({ sync_code: newCode.toLowerCase() })
      toast.success('Sync code updated')
      setChangeCodeOpen(false)
    } catch {
      toast.error('That code is taken — try another')
    }
  }

  const toggleTheme = async () => {
    const next = (profile?.theme || 'dark') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    await updateProfile({ theme: next })
  }

  const toggleUnits = async () => {
    const next = profile?.unit_system === 'imperial' ? 'metric' : 'imperial'
    await updateProfile({ unit_system: next })
  }

  return (
    <div style={{ paddingTop: 28 }}>
      <div className="row-between header-top-row" style={{ alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow">Protocol log</div>
          {editingName ? (
            <input
              value={nameDraft}
              autoFocus
              onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 600, padding: '4px 8px', maxWidth: 420 }}
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 600, margin: '2px 0 0', cursor: 'text' }}
            >
              {profile?.plan_name || 'Sustained energy deficit'}
            </h1>
          )}
        </div>

        <div style={{ textAlign: 'right' }} className="header-meta">
          <div className="mono-meta">
            {age ? `${age}yo ` : ''}<b>{profile?.sex || '—'}</b> · {profile?.height_cm || '—'}cm · <b>{profile?.starting_weight_kg || '—'}</b> kg start
          </div>
          <div className="mono-meta" style={{ marginTop: 3 }}>
            <b>{activityLabel}</b> activity · TDEE &asymp; <b>{planSummary?.tdee0?.toLocaleString() || '—'}</b> kcal
          </div>
          <div className="mono-meta" style={{ marginTop: 3 }}>
            sync code: <b>{profile?.sync_code || '—'}</b> <a onClick={() => setChangeCodeOpen(true)}>change</a> · <a onClick={() => setEditPlanOpen(true)}>edit plan</a>
          </div>
          <div className="mono-meta text-teal" style={{ marginTop: 3 }}>synced to cloud</div>
        </div>
      </div>

      <div className="row-between header-toggle-row" style={{ marginBottom: 20 }}>
        <div />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-pill" onClick={toggleUnits}>
            {profile?.unit_system === 'imperial' ? 'LB / IN' : 'KG / CM'}
          </button>
          <button className="btn btn-pill btn-teal" onClick={toggleTheme}>
            {(profile?.theme || 'dark') === 'dark' ? 'LIGHT' : 'DARK'}
          </button>
        </div>
      </div>

      <Modal open={editPlanOpen} onClose={() => setEditPlanOpen(false)} title="Edit plan">
        <PlanEditor onDone={() => setEditPlanOpen(false)} />
      </Modal>

      <Modal open={changeCodeOpen} onClose={() => setChangeCodeOpen(false)} title="Change sync code">
        <label>New sync code</label>
        <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. bb" style={{ marginBottom: 16 }} />
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={changeSyncCode}>Save code</button>
      </Modal>
    </div>
  )
}
