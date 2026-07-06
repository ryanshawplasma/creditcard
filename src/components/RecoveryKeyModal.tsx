import { useEffect, useState } from 'react';
import { KeyRound, Copy, Download, Check, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { downloadBlob } from '@/lib/utils';

export function RecoveryKeyDialog({
  open,
  recoveryKey,
  onClose,
  title = 'Save your recovery key',
}: {
  open: boolean;
  recoveryKey: string;
  onClose: () => void;
  title?: string;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) { setSaved(false); setCopied(false); }
  }, [open, recoveryKey]);

  function copy() {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    toast.success('Recovery key copied');
    setTimeout(() => setCopied(false), 2000);
  }
  function download() {
    downloadBlob(
      `CreditVault AI — Recovery Key\n\n${recoveryKey}\n\nKeep this safe and private. It can unlock your vault if you forget your master password. Anyone with this key AND access to your device can open your vault.`,
      'creditvault-recovery-key.txt',
      'text/plain',
    );
    setSaved(true);
  }

  return (
    <Modal open={open} onClose={saved ? onClose : () => {}} size="md" title={
      <span className="flex items-center gap-2"><KeyRound size={18} className="text-accent" /> {title}</span>
    }>
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>This is the <b>only</b> way to get back into your vault if you forget your master password. We can’t recover it for you. Store it in a password manager or print it — don’t lose it.</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface-2 p-4 text-center">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-subtle">Your recovery key</p>
          <p className="select-all break-words font-mono text-lg font-semibold tracking-wider text-fg">{recoveryKey}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={copy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</Button>
          <Button onClick={download}><Download size={15} /> Download</Button>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
          <span className="text-muted">I’ve saved my recovery key somewhere safe.</span>
        </label>

        <Button variant="primary" className="w-full" disabled={!saved} onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** Shows the just-generated recovery key immediately after sign-up. */
export function RecoveryKeyModal() {
  const { pendingRecoveryKey, clearPendingRecoveryKey } = useAuth();
  return (
    <RecoveryKeyDialog
      open={!!pendingRecoveryKey}
      recoveryKey={pendingRecoveryKey ?? ''}
      onClose={clearPendingRecoveryKey}
      title="Save your recovery key"
    />
  );
}
