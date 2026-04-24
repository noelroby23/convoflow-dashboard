import { useState, useEffect } from 'react'
import { Save, RefreshCw, Bell, Users, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'
import { useDailyAISummary } from '../context/DailyAISummaryContext'

// Maps UI labels to normalized target metric_name keys in Supabase.
// These metric_names match what the backend (n8n alerts, reports) expects.
const TARGET_CONFIG = [
  { key: 'daily_spend',      label: 'Daily Spend (AED)',       default: 420 },
  { key: 'monthly_leads',    label: 'Monthly Leads',           default: 100 },
  { key: 'monthly_meetings', label: 'Monthly Meetings',        default: 30 },
  { key: 'monthly_closes',   label: 'Monthly Closes',          default: 4 },
  { key: 'weekly_leads',     label: 'Weekly Leads',            default: 28 },
  { key: 'weekly_meetings',  label: 'Weekly Meetings',         default: 8 },
  { key: 'weekly_shows',     label: 'Weekly Shows',            default: 6 },
  { key: 'weekly_closes',    label: 'Weekly Closes',           default: 1 },
  { key: 'cpl_target',       label: 'CPL Target (AED)',        default: 85 },
  { key: 'cost_per_meeting', label: 'Cost / Meeting (AED)',    default: 600 },
  { key: 'cost_per_active',  label: 'Cost / Active Opp (AED)', default: 1200 },
  { key: 'show_rate',        label: 'Show Rate (%)',           default: 75 },
  { key: 'meeting_rate',     label: 'Meeting Rate (%)',        default: 18 },
  { key: 'roas_target',      label: 'ROAS Target (x)',         default: 4 },
]

const defaultTargets = Object.fromEntries(TARGET_CONFIG.map(t => [t.key, t.default]))

const syncSources = [
  { name: 'Meta Ads', lastSync: '2 min ago', status: 'live', description: 'Facebook & Instagram ad data' },
  { name: 'GoHighLevel (GHL)', lastSync: '5 min ago', status: 'live', description: 'CRM pipeline & lead stages' },
  { name: 'VAPI (AI Calls)', lastSync: '12 min ago', status: 'live', description: 'AI call recordings & summaries' },
]

const fallbackTeamMembers = [
  { name: 'Mark Marti', email: 'mark@convoflow.ae', role: 'Admin', avatar: 'MM' },
  { name: 'Abdus', email: 'abdus@convoflow.ae', role: 'Admin', avatar: 'AB' },
  { name: 'Noel', email: 'noel@convoflow.ae', role: 'Viewer', avatar: 'NL' },
]

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
  const { currentClientId } = useDashboard()
  const { isEnabled, setIsEnabled } = useDailyAISummary()
  const [targets, setTargets] = useState(defaultTargets)
  const [teamMembers, setTeamMembers] = useState(fallbackTeamMembers)
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
    supabase
      .from('targets')
      .select('metric_name, target_value')
      .eq('client_id', currentClientId)
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message)
          return
        }
        if (data && data.length) {
          setTargets(prev => {
            const next = { ...prev }
            for (const row of data) {
              next[row.metric_name] = Number(row.target_value)
            }
            return next
          })
        }
      })
  }, [currentClientId])

  useEffect(() => {
    supabase
      .from('team_members')
      .select('name, email, role')
      .eq('client_id', currentClientId)
      .order('invited_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
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
    setSaving(true)
    setLoadError(null)
    const rows = TARGET_CONFIG.map(t => ({
      client_id: currentClientId,
      metric_name: t.key,
      target_value: Number(targets[t.key] ?? t.default),
    }))
    const { error } = await supabase
      .from('targets')
      .upsert(rows, { onConflict: 'client_id,metric_name' })
    setSaving(false)
    if (error) {
      setLoadError(error.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleInvite = async () => {
    if (!teamTableAvailable) return

    setInviteError(null)

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
          {syncSources.map(src => (
            <div key={src.name} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-[#0F0F1A]">{src.name}</p>
                  <p className="text-xs text-[#6B7280]">{src.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-[#6B7280]">Last sync</p>
                  <p className="text-sm font-medium text-[#0F0F1A]">{src.lastSync}</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
                  <RefreshCw className="w-3 h-3" />
                  Sync now
                </button>
              </div>
            </div>
          ))}
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
            {teamMembers.map(member => (
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
            ))}
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
