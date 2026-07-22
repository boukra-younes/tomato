export default function EquationPanel({ maintenance, deficit, target }) {
  return (
    <div className="equation-panel">
      <div className="equation-cell">
        <div className="equation-value text-steel">{Math.round(maintenance)}</div>
        <div className="equation-label">Maintenance</div>
      </div>
      <div className="equation-op">&minus;</div>
      <div className="equation-cell">
        <div className="equation-value text-sienna">{Math.round(Math.abs(deficit))}</div>
        <div className="equation-label">{deficit >= 0 ? 'Deficit' : 'Surplus'}</div>
      </div>
      <div className="equation-op">=</div>
      <div className="equation-cell">
        <div className="equation-value text-teal">{Math.round(target)}</div>
        <div className="equation-label">Target Calories</div>
      </div>
    </div>
  )
}
