import { eachDayOfInterval, subDays, format } from 'date-fns'

export default function Heatmap({ data, colorFn }) {
  const end = new Date()
  const start = subDays(end, 363)
  const days = eachDayOfInterval({ start, end })
  const map = Object.fromEntries(data.map(d => [d.date, d.value]))

  const weeks = []
  let currentWeek = []
  days.forEach((day, i) => {
    currentWeek.push(day)
    if (day.getDay() === 6 || i === days.length - 1) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 8 }}>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {week.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const value = map[key] || 0
            return (
              <div
                key={key}
                title={`${key}: ${value}`}
                style={{
                  width: 11, height: 11, borderRadius: 2,
                  background: colorFn(value)
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
