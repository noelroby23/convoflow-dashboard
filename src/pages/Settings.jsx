import { useState, useEffect } from 'react'
import { Save, RefreshCw, Bell, Users, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useDailyAISummary } from '../context/DailyAISummaryContext'

// The editable targets are exactly the five cf.target measures — the same ones
// the Lead Desk "Targets & progress" panel scores against, so a number changed
// here moves that bar and nothing else.
//
// The previous list carried 18 keys, 13 of them spend / CPL / revenue / ROAS.
// cf measures none of those (no ad spend, no deal value — phase 2), so those
// rows let you set a target for a number that is always null. Removed rather
// than left as editable decoration.
//
// `metric` and `period` are what cf.target actually stores; `key` is the
// derived name cf_targets_map exposes to the rest of the UI.
const TARGET_CONFIG = [
  { key: 'daily_leads',     metric: 'leads',    period: 'day',  category: 'ads',   label: 'Leads / day',     default: 40 },
  { key: 'daily_reached',   metric: 'reached',  period: 'day',  category: 'agent', label: 'Reached / day',   default: 25 },
  { key: 'daily_bookings',  metric: 'bookings', period: 'day',  category: 'agent', label: 'Bookings / day',  default: 6 },
  { key: 'weekly_showups',  metric: 'showups',  period: 'week', category: 'sales', label: 'Show-ups / week', default: 20 },
  { key: 'weekly_closes',   metric: 'closes',   period: 'week', category: 'sales', label: 'Closes / week',   default: 5 },
]

const defaultTargets = Object.fromEntries(TARGET_CONFIG.map(t => [t.key, t.default]))

const syncSources = []

const alertRules = [
  { id: 'cpl_spike', label: 'CPL spikes above AED 120', description: 'Notify when any ad\'s CPL exceeds AED 120' },
  { id: 'freq_high', label: 'Frequency above 2.0', description: 'Alert when any ad frequency hits creative fatigue zone' },
  { id: 'lead_drop', label: 'Daily leads drop below 5', description: 'Notify if daily lead volume falls under threshold' },
  { id: 'no_show', label: 'No-show rate above 50%', description: 'Alert when meeting no-show rate worsens' },
  { id: 'sync_fail', label: 'Sync failure', description: 'Alert on any data source sync failure' },
]

function Toggle({ defaultOn = true, checked, onChange }) {
  const [internalOn, setInternalOn] = useState(defaultOn)
  const isControlled = checked !== undefined
  const on = isControlled ? checked : internalOn

  const handleToggle = () => {
    const next = !on
    if (!isControlled) setInternalOn(next)
    onChange?.(next)
  }

  return (
    <button
      onClick={handleToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-[#EC4899]' : 'bg-[#E5E7EB]'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function Settings() {
  const { currentClientId, refresh } = useDashboard()
  const { isEnabled, setIsEnabled } = useDailyAISummary()
  const [targets, setTargets] = useState(defaultTargets)
  const [teamMembers, setTeamMembers] = useState([])
  const [teamTableAvailable, setTeamTableAvailable] = useState(true)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Viewer')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [inviteError, setInviteError] = useState(null)
  const [inviteSaved, setInviteSaved] = useState(false)
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    setLoadError(null)

    setTargets(defaultTargets)

    supabase.rpc('cf_targets_map', { p: { region: 'uae' } })
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message)
          return
        }
        if (data && Object.keys(data).length) {
          setTargets(prev => {
            const next = { ...prev }
            for (const t of TARGET_CONFIG) {
              if (data[t.key] != null) next[t.key] = Number(data[t.key])
            }
            return next
          })
        }
      })
  }, [currentClientId])

  useEffect(() => {
    setTeamMembers([])

    // cf has no team model — there is no user/rep table in the v2 schema, and
    // the legacy one held a single row. cf_team_members returns an empty set so
    // this renders its "unavailable" state rather than an error, until a team
    // model is actually built (phase 2, alongside Sales Performance).
    supabase.rpc('cf_team_members', { p: { region: 'uae' } })
      .then(({ data, error }) => {
        if (error || !data?.length) {
          setTeamTableAvailable(false)
          return
        }

        setTeamTableAvailable(true)
        if (data?.length) {
          setTeamMembers(data.map(member => ({
            ...member,
            avatar: member.name?.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'TM',
          })))
        }
      })
  }, [currentClientId])

  const handleSave = async () => {
    if (!currentClientId) {
      setLoadError('Select a single market before saving target settings.')
      return
    }

    setSaving(true)
    setLoadError(null)
    // One RPC per metric. cf_dash_set_target upserts on (region, metric,
    // period), so saving twice is idempotent rather than duplicating rows.
    const results = await Promise.all(TARGET_CONFIG.map(t =>
      supabase.rpc('cf_dash_set_target', {
        p: {
          region: 'uae',
          metric: t.metric,
          period: t.period,
          category: t.category,
          target: Number(targets[t.key] ?? t.default),
        },
      })
    ))
    setSaving(false)
    const failed = results.find(r => r.error)
    if (failed) {
      setLoadError(failed.error.message)
      return
    }
    refresh()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleInvite = async () => {
    if (!teamTableAvailable) return

    setInviteError(null)

    if (!currentClientId) {
      setInviteError('Select a single market before inviting team members.')
      return
    }

    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Name and email are required.')
      return
    }

    setInviting(true)
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        client_id: currentClientId,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        invited_at: new Date().toISOString(),
      })
      .select('name, email, role')
      .single()

    setInviting(false)

    if (error) {
      setInviteError(error.message)
      return
    }

    setTeamMembers(prev => [
      {
        ...data,
        avatar: data.name?.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'TM',
      },
      ...prev,
    ])
    setInviteName('')
    setInviteEmail('')
    setInviteRole('Viewer')
    setInviteSaved(true)
    setTimeout(() => setInviteSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Targets */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#EC4899]" />
            <h2 className="text-base font-semibold text-[#0F0F1A]">Target Metrics</h2>
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              saved ? 'bg-green-100 text-green-700' : 'bg-[#EC4899] text-white hover:bg-[#DB2777]'
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
        <div className="p-6">
          {loadError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {loadError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {TARGET_CONFIG.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
                <label className="text-sm font-medium text-[#333333]">{label}</label>
                <input
                  type="number"
                  value={targets[key] ?? ''}
                  onChange={e => setTargets(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-28 text-right text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#0F0F1A] font-semibold focus:outline-none focus:border-[#EC4899] focus:ring-1 focus:ring-pink-100"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0F0F1A]">Daily AI Summary Popup</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Show yesterday&apos;s key metrics when the dashboard first opens.</p>
          </div>
          <Toggle checked={isEnabled} onChange={setIsEnabled} />
        </div>
      </div>

      {/* Sync status */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#EC4899]" />
          <h2 className="text-base font-semibold text-[#0F0F1A]">Data Sources & Sync</h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {syncSources.length ? syncSources.map(src => (
            <div key={src.name} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-[#0F0F1A]">{src.name}</p>
                  <p className="text-xs text-[#6B7280]">{src.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#6B7280]">Last sync</p>
                <p className="text-sm font-medium text-[#0F0F1A]">{src.lastSync}</p>
              </div>
            </div>
          )) : (
            <div className="px-6 py-8 text-center text-sm text-[#9CA3AF]">
              Sync status is not connected yet.
            </div>
          )}
        </div>
      </div>

      {/* Team */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#EC4899]" />
            <h2 className="text-base font-semibold text-[#0F0F1A]">Team Members</h2>
          </div>
        </div>
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          {!teamTableAvailable ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Team management coming soon — contact support to add members.
            </div>
          ) : (
            <div className="grid grid-cols-[1.2fr_1.4fr_0.8fr_auto] gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1">Name</label>
                <input value={inviteName} onChange={e => setInviteName(e.target.value)} className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#EC4899]" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1">Email</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#EC4899]" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#EC4899] bg-white">
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <button onClick={handleInvite} disabled={inviting} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inviteSaved ? 'bg-green-100 text-green-700' : 'bg-[#EC4899] text-white hover:bg-[#DB2777]'} disabled:opacity-60`}>
                {inviting ? 'Inviting...' : inviteSaved ? 'Invited!' : 'Invite Member'}
              </button>
            </div>
          )}
          {inviteError && <p className="mt-3 text-sm text-red-700">{inviteError}</p>}
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              {['Member', 'Email', 'Role', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide px-6 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {teamMembers.length ? teamMembers.map(member => (
              <tr key={member.email} className="hover:bg-[#F9FAFB] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EC4899] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{member.avatar}</span>
                    </div>
                    <span className="text-sm font-medium text-[#0F0F1A]">{member.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[#6B7280]">{member.email}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${member.role === 'Admin' ? 'bg-pink-100 text-[#EC4899]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-xs text-[#6B7280] hover:text-red-600 transition-colors">Remove</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#9CA3AF]">
                  No team members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Alert rules */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#EC4899]" />
          <h2 className="text-base font-semibold text-[#0F0F1A]">Alert Rules</h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {alertRules.map((rule, i) => (
            <div key={rule.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#0F0F1A]">{rule.label}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{rule.description}</p>
              </div>
              <Toggle defaultOn={i < 3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
