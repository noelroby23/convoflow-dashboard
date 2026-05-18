import { useState } from 'react'
import KPICard from '../components/ui/KPICard'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import { useDashboardContactsByBucket, useSarahPerformance, useTargets } from '../hooks/useDashboardData'

const SARAH_CARDS = [
  { key: 'follow_up', label: 'Follow Up Pending' },
  { key: 'wa_chatbot', label: 'WA - Chatbot' },
  { key: 'call_no_engagement', label: 'Call Connected - No Engagement' },
  { key: 'wa_requested', label: 'WA Requested' },
  { key: 'human_requested', label: 'Human-Requested' },
  { key: 'callback', label: 'callback requested' },
  { key: 'qualified_no_meeting', label: 'Qualified - No Meeting' },
  { key: 'meeting_booked', label: 'Meeting Booked' },
  { key: 'no_show', label: 'No Show' },
  { key: 'active', label: 'Active' },
  { key: 'not_interested', label: 'not interested' },
  { key: 'disqualified', label: 'Disqualified By AI' },
  { key: 'wrong_number', label: 'wrong number' },
  { key: 'new_lead', label: 'New Lead' },
]

const STAGE_BORDER_CLASS = {
  meeting_booked: 'border-l-[#16A34A]',
  active: 'border-l-[#16A34A]',
  wa_chatbot: 'border-l-[#2563EB]',
  contacted: 'border-l-[#2563EB]',
  callback: 'border-l-[#2563EB]',
  qualified_no_meeting: 'border-l-[#2563EB]',
  call_no_engagement: 'border-l-[#2563EB]',
  wa_requested: 'border-l-[#2563EB]',
  human_requested: 'border-l-[#2563EB]',
  follow_up: 'border-l-[#F59E0B]',
  new_lead: 'border-l-[#F59E0B]',
  no_show: 'border-l-[#F59E0B]',
  not_interested: 'border-l-[#DC2626]',
  disqualified: 'border-l-[#DC2626]',
  wrong_number: 'border-l-[#DC2626]',
}

const STAGE_TEXT_CLASS = {
  meeting_booked: 'text-[#16A34A]',
  active: 'text-[#16A34A]',
  wa_chatbot: 'text-[#2563EB]',
  contacted: 'text-[#2563EB]',
  callback: 'text-[#2563EB]',
  qualified_no_meeting: 'text-[#2563EB]',
  call_no_engagement: 'text-[#2563EB]',
  wa_requested: 'text-[#2563EB]',
  human_requested: 'text-[#2563EB]',
  follow_up: 'text-[#D97706]',
  new_lead: 'text-[#D97706]',
  no_show: 'text-[#D97706]',
  not_interested: 'text-[#DC2626]',
  disqualified: 'text-[#DC2626]',
  wrong_number: 'text-[#DC2626]',
}

function formatPercent(percent) {
  const value = Number(percent ?? 0)
  return `${value.toFixed(value > 0 ? 1 : 0)}% of total leads`
}

function formatContactStage(contact) {
  return contact?.stage_label || contact?.current_stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'
}

export default function SarahsPerformance() {
  const { byBucket, totalLeads, loading, error } = useSarahPerformance()
  const { data: targets } = useTargets()
  const [selectedBucket, setSelectedBucket] = useState(null)
  const { data: drilldownContacts, loading: drilldownLoading, error: drilldownError } = useDashboardContactsByBucket(selectedBucket)

  const selectedCard = SARAH_CARDS.find(card => card.key === selectedBucket)
  const conversations = Math.max(totalLeads - Number(byBucket.new_lead?.contact_count ?? 0), 0)
  const meetingsBooked = ['meeting_booked', 'no_show', 'active', 'showed', 'closed_won', 'closed_lost'].reduce(
    (sum, bucket) => sum + Number(byBucket[bucket]?.contact_count ?? 0),
    0
  )
  const bookingRate = totalLeads > 0 ? Number(((meetingsBooked / totalLeads) * 100).toFixed(1)) : 0
  const meetingsTarget = targets?.monthly_meetings ? Math.round(targets.monthly_meetings / 2) : 15

  return (
    <div>
      <ErrorBoundary>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          <KPICard
            label="Total Leads"
            value={totalLeads}
            loading={loading}
            description="All non-test leads assigned to Sarah's pipeline."
          />
          <KPICard
            label="Conversations"
            value={conversations}
            loading={loading}
            description="Leads Sarah spoke with, including those who progressed further."
          />
          <KPICard
            label="Meetings Booked"
            value={meetingsBooked}
            loading={loading}
            target={meetingsTarget}
            description="Total meetings booked by Sarah, including those who showed or closed."
          />
          <KPICard
            label="Booking Rate"
            value={bookingRate}
            suffix="%"
            loading={loading}
            description="Meetings booked as a share of total leads."
          />
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#0F0F1A]">Stage Breakdown</h2>
            <p className="text-xs text-[#6B7280] mt-1">Sarah-owned stages only, from follow-up through meeting booked and early exits.</p>
          </div>

          {error && !loading && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...Array(9)].map((_, index) => (
                <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] border-l-4 border-l-[#E5E7EB] p-5 shadow-sm">
                  <div className="skeleton h-4 w-40 mb-4" />
                  <div className="skeleton h-9 w-20 mb-3" />
                  <div className="skeleton h-3 w-28" />
                </div>
              ))}
            </div>
          ) : !SARAH_CARDS.some(card => byBucket[card.key]) ? (
            <p className="text-sm text-[#9CA3AF] text-center py-12">No Sarah stage data available yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {SARAH_CARDS.map(card => {
                const row = byBucket[card.key]
                const count = Number(row?.contact_count ?? 0)
                const percentage = Number(row?.percentage ?? 0)

                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setSelectedBucket(card.key)}
                    className={`rounded-xl border border-[#E5E7EB] border-l-4 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${STAGE_BORDER_CLASS[card.key] || 'border-l-[#E5E7EB]'}`}
                  >
                    <p className="text-sm font-semibold text-[#0F0F1A]">{card.label}</p>
                    <p className={`mt-3 text-3xl font-bold ${STAGE_TEXT_CLASS[card.key] || 'text-[#0F0F1A]'}`}>
                      {count.toLocaleString()}
                    </p>
                    <p className="mt-2 text-xs text-[#9CA3AF]">{formatPercent(percentage)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </ErrorBoundary>

      {selectedBucket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={(event) => { if (event.target === event.currentTarget) setSelectedBucket(null) }}
        >
          <div className="w-full max-w-5xl rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F0F1A]">{selectedCard?.label ?? 'Sarah Bucket'} Contacts</h3>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {drilldownContacts?.length ?? 0} contacts in {selectedBucket}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBucket(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {drilldownLoading ? (
                <div className="space-y-3">{[...Array(5)].map((_, index) => <div key={index} className="skeleton h-12 w-full" />)}</div>
              ) : drilldownError ? (
                <p className="text-sm text-[#B91C1C] text-center py-8">Failed to load contacts for this bucket.</p>
              ) : !drilldownContacts?.length ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">No contacts found for this bucket.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        {['Name', 'Company', 'Email', 'Phone', 'Stage', 'Source'].map(heading => (
                          <th key={heading} className="pb-2 pr-4 text-left text-xs font-semibold text-[#6B7280]">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownContacts.map((contact, index) => (
                        <tr key={contact.contact_id ?? contact.ghl_contact_id ?? index} className="border-b border-[#F3F4F6]">
                          <td className="py-3 pr-4 font-medium text-[#0F0F1A]">{contact.full_name || 'Unknown'}</td>
                          <td className="py-3 pr-4 text-[#6B7280]">{contact.company || contact.company_name || '—'}</td>
                          <td className="py-3 pr-4 text-[#6B7280]">{contact.email || '—'}</td>
                          <td className="py-3 pr-4 text-[#6B7280]">{contact.phone || '—'}</td>
                          <td className="py-3 pr-4 text-[#6B7280]">{formatContactStage(contact)}</td>
                          <td className="py-3 pr-4 text-[#6B7280]">{contact.ad_name || contact.source_ad || contact.source || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
