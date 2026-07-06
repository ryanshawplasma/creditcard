import { useRef, useState } from 'react';
import {
  Palette, Bell, Send, Mail, Globe, Database, ShieldCheck, Download, Upload,
  FileSpreadsheet, Trash2, Check, Moon, Sun, Clock, ScrollText,
} from 'lucide-react';
import { useData } from '@/store/data';
import { useTheme, ACCENTS } from '@/store/theme';
import { useToast } from '@/components/ui/Toast';
import { Page, PageHeader } from '@/components/ui/Page';
import { Button, Field, Input, Select, Switch, Badge } from '@/components/ui/primitives';
import { saveSettings, exportBackup, importBackup } from '@/lib/repo';
import { db } from '@/lib/db';
import { money, fmtDate } from '@/lib/format';
import { downloadBlob } from '@/lib/utils';
import type { ReminderChannel } from '@/types';

const OFFSET_PRESETS = [15, 10, 7, 5, 3, 2, 1];
const CHANNELS: ReminderChannel[] = ['Desktop', 'Email', 'Telegram', 'SMS'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];

export function SettingsPage() {
  const { settings, cards, owners, banks, audit } = useData();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const toast = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const r = settings.reminder;

  async function toggleOffset(o: number) {
    const has = r.offsets.includes(o);
    const offsets = has ? r.offsets.filter((x) => x !== o) : [...r.offsets, o].sort((a, b) => b - a);
    await saveSettings({ reminder: { ...r, offsets } });
  }
  async function toggleChannel(c: ReminderChannel) {
    const has = r.channels.includes(c);
    const channels = has ? r.channels.filter((x) => x !== c) : [...r.channels, c];
    await saveSettings({ reminder: { ...r, channels } });
  }

  async function handleExportJSON() {
    const json = await exportBackup();
    downloadBlob(json, `creditvault-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success('Backup exported', 'Card numbers remain encrypted inside the file.');
  }

  function handleExportCSV() {
    const rows = [
      ['Card', 'Bank', 'Owner', 'Network', 'Last4', 'Limit', 'Outstanding', 'Utilization%', 'DueDay', 'Interest%', 'AnnualFee', 'RewardPoints', 'Status'],
      ...cards.map((c) => [
        c.name, banks.find((b) => b.id === c.bankId)?.name ?? '', owners.find((o) => o.id === c.ownerId)?.name ?? '',
        c.network, c.last4, c.creditLimit, c.currentBalance, ((c.currentBalance / (c.creditLimit || 1)) * 100).toFixed(1),
        c.dueDay, c.interestRate ?? '', c.annualFee ?? '', c.rewardPoints ?? '', c.status,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, `creditvault-cards-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    toast.success('CSV exported', 'Opens directly in Excel or Google Sheets.');
  }

  async function handleImport(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      await importBackup(text);
      toast.success('Backup restored', 'Your data has been imported.');
    } catch {
      toast.error('Import failed', 'The file could not be read as a valid backup.');
    }
  }

  async function handleReset() {
    await db.delete();
    location.reload();
  }

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Personalise CreditVault AI and manage your data" />

      <div className="space-y-5">
        {/* Appearance */}
        <SettingsCard icon={Palette} title="Appearance" desc="Theme and accent colour">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Theme</span>
            <div className="inline-flex rounded-xl border border-border bg-surface-2 p-0.5">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${theme === t ? 'bg-elevated text-fg shadow-soft' : 'text-muted'}`}>
                  {t === 'dark' ? <Moon size={14} /> : <Sun size={14} />} {t === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted">Accent colour</span>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button key={a.key} onClick={() => setAccent(a.key)} style={{ background: a.swatch }} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-surface transition ${accent === a.key ? 'ring-fg' : 'ring-transparent'}`} title={a.label}>
                  {accent === a.key && <Check size={14} className="mx-auto text-white" />}
                </button>
              ))}
            </div>
          </div>
        </SettingsCard>

        {/* Reminders */}
        <SettingsCard icon={Bell} title="Reminder preferences" desc="When and how you get reminded before due dates">
          <div>
            <p className="mb-2 text-sm text-muted">Remind me these many days before</p>
            <div className="flex flex-wrap gap-2">
              {OFFSET_PRESETS.map((o) => (
                <button key={o} onClick={() => toggleOffset(o)} className={`rounded-lg border px-3 py-1.5 text-sm transition ${r.offsets.includes(o) ? 'border-accent bg-accent/12 text-accent' : 'border-border text-muted hover:text-fg'}`}>
                  {o} day{o > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Channels</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button key={c} onClick={() => toggleChannel(c)} className={`rounded-lg border px-3 py-1.5 text-sm transition ${r.channels.includes(c) ? 'border-accent bg-accent/12 text-accent' : 'border-border text-muted hover:text-fg'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <ToggleRow label="Remind me on the due date" checked={r.includeDueToday} onChange={(v) => saveSettings({ reminder: { ...r, includeDueToday: v } })} />
            <ToggleRow label="Keep reminding while overdue" checked={r.includeOverdue} onChange={(v) => saveSettings({ reminder: { ...r, includeOverdue: v } })} />
          </div>
        </SettingsCard>

        {/* Notification channels */}
        <SettingsCard icon={Send} title="Notification channels" desc="Email and Telegram delivery (architecture ready)">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
              <Mail size={18} className="mt-0.5 text-accent" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email reminders</span>
                  <Switch checked={!!settings.email?.enabled} onChange={(v) => saveSettings({ email: { ...settings.email, enabled: v } })} />
                </div>
                <Input className="mt-2" placeholder="you@email.com" defaultValue={settings.email?.address} onBlur={(e) => saveSettings({ email: { ...settings.email, enabled: settings.email?.enabled ?? false, address: e.target.value } })} />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
              <Send size={18} className="mt-0.5 text-info" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">Telegram bot <Badge tone="info">Future ready</Badge></span>
                  <Switch checked={!!settings.telegram?.enabled} onChange={(v) => saveSettings({ telegram: { ...settings.telegram, enabled: v } })} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input placeholder="Bot token" defaultValue={settings.telegram?.botToken} onBlur={(e) => saveSettings({ telegram: { ...settings.telegram, enabled: settings.telegram?.enabled ?? false, botToken: e.target.value } })} />
                  <Input placeholder="Chat ID" defaultValue={settings.telegram?.chatId} onBlur={(e) => saveSettings({ telegram: { ...settings.telegram, enabled: settings.telegram?.enabled ?? false, chatId: e.target.value } })} />
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* Regional & security */}
        <SettingsCard icon={Globe} title="Regional & security" desc="Currency, locale and auto-lock">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Currency">
              <Select value={settings.currency} onChange={(e) => saveSettings({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
            <Field label="Locale">
              <Select value={settings.locale} onChange={(e) => saveSettings({ locale: e.target.value })}>
                {['en-IN', 'en-US', 'en-GB', 'de-DE', 'fr-FR'].map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Auto-lock after">
              <Select value={String(settings.sessionTimeoutMin)} onChange={(e) => saveSettings({ sessionTimeoutMin: Number(e.target.value) })}>
                {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/5 p-3 text-xs text-success">
            <ShieldCheck size={15} /> Card numbers & CVVs are AES-256 encrypted with a key derived from your master password. Nothing is sent to any server.
          </div>
        </SettingsCard>

        {/* Data */}
        <SettingsCard icon={Database} title="Backup & data" desc="Export, import and portability">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={handleExportJSON}><Download size={15} /> Export encrypted backup (JSON)</Button>
            <Button onClick={handleExportCSV}><FileSpreadsheet size={15} /> Export cards (CSV / Excel)</Button>
            <Button onClick={() => importRef.current?.click()}><Upload size={15} /> Import / restore backup</Button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => handleImport(e.target.files?.[0])} />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            {confirmReset ? (
              <div className="flex items-center justify-between rounded-xl border border-danger/30 bg-danger/5 p-3">
                <span className="text-sm text-danger">This permanently deletes everything on this device. Are you sure?</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
                  <Button size="sm" variant="danger" onClick={handleReset}>Delete everything</Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmReset(true)}><Trash2 size={15} /> Reset vault</Button>
            )}
          </div>
        </SettingsCard>

        {/* Activity log */}
        <SettingsCard icon={ScrollText} title="Activity & audit log" desc="Recent actions in your vault">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {audit.length === 0 ? <p className="text-sm text-subtle">No activity recorded.</p> : audit.slice(0, 30).map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-xs">
                <Clock size={13} className="shrink-0 text-subtle" />
                <span className="flex-1 text-muted"><span className="font-medium text-fg">{log.action}</span>{log.detail ? ` — ${log.detail}` : ''}</span>
                <span className="text-subtle">{fmtDate(log.at.slice(0, 10))} {new Date(log.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </SettingsCard>

        <p className="pb-6 text-center text-xs text-subtle">
          CreditVault AI · v1.0 · Local-first & encrypted · {cards.length} cards · {owners.length} people · Total outstanding {money(cards.reduce((s, c) => s + c.currentBalance, 0))}
        </p>
      </div>
    </Page>
  );
}

function SettingsCard({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent"><Icon size={18} /></span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}
