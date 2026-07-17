'use client'

import { useState } from 'react'
import type { CohortConfig } from './page'

interface Props {
  configs: CohortConfig[]
  enrolledCounts: Record<string, number>
}

const SECTION_LABELS: { key: keyof CohortConfig; label: string; desc: string }[] = [
  { key: 'section_cohort_overview',    label: 'Cohort Overview',       desc: 'Enrollment totals, sweep completion rate, avg objectives/user' },
  { key: 'section_objective_tracking', label: 'Objective Tracking',    desc: 'Category distribution, avg confidence, % with target dates' },
  { key: 'section_confidence_trends',  label: 'Confidence Trends',     desc: 'Avg confidence over last 4 sweep cycles' },
  { key: 'section_sweep_activity',     label: 'Sweep Activity',        desc: 'Sweeps run, % users with >=1 sweep, missed sweep count' },
  { key: 'section_cross_dep_flags',    label: 'Cross-Dep Flags',       desc: 'Cross-objective dependencies surfaced (anonymized)' },
  { key: 'section_engagement_summary', label: 'Engagement Summary',    desc: 'Ask Meridian usage, action logging, last-active distribution' },
  { key: 'section_predictions_active', label: 'Active Predictions',    desc: 'Auto-logged predictions, avg horizon date, % pending outcome' },
  { key: 'section_top_signals',        label: 'Top Signals',           desc: 'Most common signal keywords this period (anonymized aggregate)' },
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const EMPTY_FORM: Omit<CohortConfig, 'id' | 'created_at' | 'updated_at' | 'last_sent_at'> = {
  org_name: '',
  org_code: '',
  section_cohort_overview: true,
  section_objective_tracking: true,
  section_confidence_trends: true,
  section_sweep_activity: true,
  section_cross_dep_flags: false,
  section_engagement_summary: true,
  section_predictions_active: false,
  section_top_signals: false,
  delivery_email: true,
  delivery_drive: false,
  recipient_emails: null,
  drive_folder_id: null,
  drive_folder_name: null,
  send_frequency: 'manual',
  send_day: null,
}

export default function CohortConfigClient({ configs: initialConfigs, enrolledCounts }: Props) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })
  const [recipientInput, setRecipientInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAddDrawer() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setRecipientInput('')
    setError(null)
    setDrawerOpen(true)
  }

  function openEditDrawer(config: CohortConfig) {
    setEditingId(config.id)
    setForm({
      org_name: config.org_name,
      org_code: config.org_code,
      section_cohort_overview: config.section_cohort_overview,
      section_objective_tracking: config.section_objective_tracking,
      section_confidence_trends: config.section_confidence_trends,
      section_sweep_activity: config.section_sweep_activity,
      section_cross_dep_flags: config.section_cross_dep_flags,
      section_engagement_summary: config.section_engagement_summary,
      section_predictions_active: config.section_predictions_active,
      section_top_signals: config.section_top_signals,
      delivery_email: config.delivery_email,
      delivery_drive: config.delivery_drive,
      recipient_emails: config.recipient_emails,
      drive_folder_id: config.drive_folder_id,
      drive_folder_name: config.drive_folder_name,
      send_frequency: config.send_frequency,
      send_day: config.send_day,
    })
    setRecipientInput((config.recipient_emails ?? []).join(', '))
    setError(null)
    setDrawerOpen(true)
  }

  function toggleSection(key: keyof typeof EMPTY_FORM) {
    setForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const emails = recipientInput
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)

    const payload = {
      ...form,
      org_code: form.org_code.toUpperCase().trim(),
      recipient_emails: emails.length > 0 ? emails : null,
    }

    const url = editingId
      ? `/api/admin/cohorts/${editingId}`
      : '/api/admin/cohorts'

    const res = await fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Save failed')
      setSaving(false)
      return
    }

    const { config } = await res.json() as { config: CohortConfig }

    if (editingId) {
      setConfigs(prev => prev.map(c => c.id === editingId ? config : c))
    } else {
      setConfigs(prev => [...prev, config])
    }

    setDrawerOpen(false)
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--text)]">Cohorts</h1>
        <button
          onClick={openAddDrawer}
          className="px-4 py-2 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors"
        >
          + Add Cohort
        </button>
      </div>

      {/* Cohort list */}
      {configs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-8 text-center">
          <p className="text-[13px] text-[var(--text3)]">No cohorts configured yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const enrolled = enrolledCounts[config.org_code] ?? 0
            const lastSent = config.last_sent_at
              ? new Date(config.last_sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : null

            const enabledSections = SECTION_LABELS
              .filter(s => config[s.key] as boolean)
              .map(s => s.label)

            const recipientDisplay = (config.recipient_emails ?? []).join(', ')

            return (
              <div key={config.id} className="bg-white rounded-2xl border border-[var(--border)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-semibold text-[var(--text)]">{config.org_name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--gray-lt)] text-[11px] font-mono font-medium text-[var(--text2)]">
                        {config.org_code}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text3)] mb-3">
                      {enrolled} enrolled
                      {lastSent ? ` · Last report: ${lastSent}` : ' · No reports sent yet'}
                    </p>

                    {enabledSections.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {enabledSections.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-full bg-blue-50 text-[11px] text-blue-700 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {config.delivery_email && recipientDisplay && (
                      <p className="text-[12px] text-[var(--text3)]">
                        Email → {recipientDisplay}
                      </p>
                    )}
                    {config.delivery_drive && config.drive_folder_name && (
                      <p className="text-[12px] text-[var(--text3)]">
                        Drive → {config.drive_folder_name}
                      </p>
                    )}

                    <p className="text-[11px] text-[var(--text3)] mt-1 capitalize">
                      Schedule: {config.send_frequency}{config.send_day ? ` (${config.send_day})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                  <button
                    onClick={async () => {
                      window.open(`/api/admin/cohorts/${config.org_code}/report/preview`, '_blank')
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
                  >
                    Preview Report
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Send report for ${config.org_name} now?`)) return
                      const res = await fetch(`/api/admin/cohorts/${config.org_code}/report/send-email`, { method: 'POST' })
                      if (res.ok) {
                        alert('Report sent.')
                        window.location.reload()
                      } else {
                        alert('Send failed.')
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
                  >
                    Send Now
                  </button>
                  {config.delivery_drive && config.drive_folder_id && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Push report to Drive for ${config.org_name}?`)) return
                        const res = await fetch(`/api/admin/cohorts/${config.org_code}/report/send-drive`, { method: 'POST' })
                        if (res.ok) alert('Pushed to Drive.')
                        else alert('Drive push failed.')
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
                    >
                      Send to Drive
                    </button>
                  )}
                  <button
                    onClick={() => openEditDrawer(config)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors ml-auto"
                  >
                    Edit Config
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Panel */}
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                {editingId ? 'Edit Cohort Config' : 'Add Cohort'}
              </h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-[var(--text3)] hover:text-[var(--text)] text-[20px] leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-[13px]">{error}</div>
              )}

              {/* Org info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Org Name</label>
                  <input
                    value={form.org_name}
                    onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)]"
                    placeholder="American Corporate Partners"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Org Code</label>
                  <input
                    value={form.org_code}
                    onChange={e => setForm(f => ({ ...f, org_code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--blue)]"
                    placeholder="ACP26"
                    disabled={!!editingId}
                  />
                  {editingId && (
                    <p className="text-[11px] text-[var(--text3)] mt-1">Org code cannot be changed after creation.</p>
                  )}
                </div>
              </div>

              {/* Report sections */}
              <div>
                <p className="text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">Report Sections</p>
                <div className="space-y-2">
                  {SECTION_LABELS.map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] cursor-pointer hover:bg-[var(--gray-lt)] transition-colors">
                      <input
                        type="checkbox"
                        checked={!!form[key as keyof typeof form]}
                        onChange={() => toggleSection(key as keyof typeof EMPTY_FORM)}
                        className="mt-0.5 accent-navy"
                      />
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text)]">{label}</p>
                        <p className="text-[11px] text-[var(--text3)]">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Delivery */}
              <div>
                <p className="text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">Delivery</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.delivery_email}
                      onChange={() => setForm(f => ({ ...f, delivery_email: !f.delivery_email }))}
                      className="accent-navy"
                    />
                    <span className="text-[13px] font-medium text-[var(--text)]">Email</span>
                  </label>

                  {form.delivery_email && (
                    <div className="ml-6">
                      <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Recipient emails (comma-separated)</label>
                      <textarea
                        value={recipientInput}
                        onChange={e => setRecipientInput(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] resize-none"
                        placeholder="susan@acp-usa.org, jason@solvega.ai"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.delivery_drive}
                      onChange={() => setForm(f => ({ ...f, delivery_drive: !f.delivery_drive }))}
                      className="accent-navy"
                    />
                    <span className="text-[13px] font-medium text-[var(--text)]">Google Drive</span>
                  </label>

                  {form.delivery_drive && (
                    <div className="ml-6 space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Drive Folder ID</label>
                        <input
                          value={form.drive_folder_id ?? ''}
                          onChange={e => setForm(f => ({ ...f, drive_folder_id: e.target.value || null }))}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--blue)]"
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Drive Folder Display Name</label>
                        <input
                          value={form.drive_folder_name ?? ''}
                          onChange={e => setForm(f => ({ ...f, drive_folder_name: e.target.value || null }))}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)]"
                          placeholder="ACP Meridian Reports"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <p className="text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">Schedule</p>
                <select
                  value={form.send_frequency}
                  onChange={e => setForm(f => ({ ...f, send_frequency: e.target.value, send_day: null }))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] bg-white"
                >
                  <option value="manual">Manual only</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                {form.send_frequency === 'weekly' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-1">Send day</label>
                    <select
                      value={form.send_day ?? ''}
                      onChange={e => setForm(f => ({ ...f, send_day: e.target.value || null }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--blue)] bg-white"
                    >
                      <option value="">Pick a day</option>
                      {DAYS.map(d => (
                        <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] flex gap-2">
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--gray-lt)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.org_name || !form.org_code}
                className="flex-1 py-2.5 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-[var(--night)] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Cohort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
