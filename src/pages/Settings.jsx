import { useState, useEffect } from 'react'
import { Save, RefreshCw, Bell, Users, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../store/dashboard'

const defaultTargets = {
  'Total Spend (AED)': 8400,
  'Leads': 100,
  'Meetings Booked': 15,
  'Showed Up': 12,
  'Active Opportunities': 8,
  'Closed Won': 2,
  'CPL (AED)': 85,
  'Cost/Meeting (AED)': 600,
  'Cost/Active (AED)': 1200,
  'Show Rate (%)': 75,
  'Meeting Rate (%)': 18,
  'ROAS (x)': 4,
}

const syncSources = [
  { name: 'Meta Ads', lastSync: '2 min ago', status: 'live', description: 'Facebook & Instagram ad data' },
  { name: 'GoHighLevel (GHL)', lastSync: '5 min ago', status: 'live', description: 'CRM pipeline & lead stages' },
  { name: 'VAPI (AI Calls)', lastSync: '12 min ago', status: 'live', description: 'AI call recordings & summaries' },
]

const teamMembers = [
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

function Toggle({ defaultOn = true }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-[#EC4899]' : 'bg-[#E5E7EB]'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function Settings() {
  const { currentClientId } = useDashboard()
  const [targets, setTargets] = useState(defaultTargets)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('targets').select('*').eq('client_id', currentClientId).single()
      .then(({ data }) => {
        if (data) {
          setTargets(prev => ({
            ...prev,
            'Total Spend (AED)': data.total_spend ?? prev['Total Spend (AED)'],
            'Leads': data.leads ?? prev['Leads'],
            'Meetings Booked': data.meetings_booked ?? prev['Meetings Booked'],
            'Showed Up': data.showed_up ?? prev['Showed Up'],
            'Active Opportunities': data.active_opportunities ?? prev['Active Opportunities'],
            'Closed Won': data.closed_won ?? prev['Closed Won'],
            'CPL (AED)': data.cpl ?? prev['CPL (AED)'],
            'Cost/Meeting (AED)': data.cost_per_meeting ?? prev['Cost/Meeting (AED)'],
            'Cost/Active (AED)': data.cost_per_active ?? prev['Cost/Active (AED)'],
            'Show Rate (%)': data.show_rate ?? prev['Show Rate (%)'],
            'Meeting Rate (%)': data.meeting_rate ?? prev['Meeting Rate (%)'],
            'ROAS (x)': data.roas ?? prev['ROAS (x)'],
          }))
        }
      })
  }, [currentClientId])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('targets').upsert({
      client_id: currentClientId,
      total_spend: targets['Total Spend (AED)'],
      leads: targets['Leads'],
      meetings_booked: targets['Meetings Booked'],
      showed_up: targets['Showed Up'],
      active_opportunities: targets['Active Opportunities'],
      closed_won: targets['Closed Won'],
      cpl: targets['CPL (AED)'],
      cost_per_meeting: targets['Cost/Meeting (AED)'],
      cost_per_active: targets['Cost/Active (AED)'],
      show_rate: targets['Show Rate (%)'],
      meeting_rate: targets['Meeting Rate (%)'],
      roas: targets['ROAS (x)'],
    }, { onConflict: 'client_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-5xl">
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
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(targets).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                <label className="text-sm font-medium text-[#333333]">{key}</label>
                <input
                  type="number"
                  value={val}
                  onChange={e => setTargets(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-28 text-right text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#0F0F1A] font-semibold focus:outline-none focus:border-[#EC4899] focus:ring-1 focus:ring-pink-100"
                />
              </div>
            ))}
          </div>
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
          <button className="px-4 py-2 rounded-lg border border-[#EC4899] text-[#EC4899] text-sm font-medium hover:bg-pink-50 transition-colors">
            + Invite member
          </button>
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
