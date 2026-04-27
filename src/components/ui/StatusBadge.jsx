const stageConfig = {
  new: { label: 'New', classes: 'bg-gray-100 text-gray-600' },
  follow_up: { label: 'Follow Up', classes: 'bg-gray-100 text-gray-600' },
  contacted: { label: 'Contacted', classes: 'bg-blue-100 text-blue-700' },
  callback: { label: 'Callback', classes: 'bg-amber-100 text-amber-700' },
  qualified_no_meeting: { label: 'Qualified No Meeting', classes: 'bg-teal-100 text-teal-700' },
  meeting_booked: { label: 'Meeting Booked', classes: 'bg-purple-100 text-purple-700' },
  no_show: { label: 'No Show', classes: 'bg-red-100 text-red-700' },
  noshow: { label: 'No Show', classes: 'bg-red-100 text-red-700' },
  showed: { label: 'Showed Up', classes: 'bg-green-100 text-green-700' },
  active: { label: 'Active', classes: 'bg-green-100 text-green-700' },
  closed_won: { label: 'Closed Won', classes: 'bg-green-100 text-green-800' },
  closed_lost: { label: 'Closed Lost', classes: 'bg-red-100 text-red-700' },
  not_interested: { label: 'Not Interested', classes: 'bg-orange-100 text-orange-700' },
  disqualified: { label: 'Disqualified', classes: 'bg-red-100 text-red-800' },
  wrong_number: { label: 'Wrong Number', classes: 'bg-slate-200 text-slate-700' },
  upcoming: { label: 'Upcoming', classes: 'bg-blue-100 text-blue-700' },
}

export default function StatusBadge({ stage, successTone = 'green' }) {
  const config = stageConfig[stage] || { label: stage, classes: 'bg-gray-100 text-gray-600' }
  const classes = successTone === 'red'
    ? config.classes.replace(/bg-green-100|text-green-700|text-green-800/g, (token) => {
        if (token === 'bg-green-100') return 'bg-red-100'
        if (token === 'text-green-700') return 'text-red-700'
        return 'text-red-800'
      })
    : config.classes

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {config.label}
    </span>
  )
}
