import { useState } from 'react';
import { KeyRound, Lock, Save } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, Field, Input } from '@/components/ui/primitives';
import { RecoveryKeyDialog } from '@/components/RecoveryKeyModal';

export function SecuritySettings() {
  const { user, changePassword, regenerateRecoveryKey, setPasswordHint } = useAuth();
  const toast = useToast();

  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const [hint, setHint] = useState(user?.hint ?? '');

  const [recPassword, setRecPassword] = useState('');
  const [recKey, setRecKey] = useState<string | null>(null);
  const [recBusy, setRecBusy] = useState(false);

  async function submitPassword() {
    if (next.length < 8) return toast.error('Too short', 'New password must be at least 8 characters.');
    if (next !== confirm) return toast.error('Mismatch', 'New passwords do not match.');
    setPwBusy(true);
    try {
      await changePassword(cur, next);
      setCur(''); setNext(''); setConfirm('');
      toast.success('Master password changed', 'Use your new password next time you unlock.');
    } catch (e) {
      toast.error('Could not change password', (e as Error).message);
    } finally {
      setPwBusy(false);
    }
  }

  async function saveHint() {
    try {
      await setPasswordHint(hint);
      toast.success('Hint saved');
    } catch (e) {
      toast.error('Could not save hint', (e as Error).message);
    }
  }

  async function regenerate() {
    if (!recPassword) return toast.error('Password required', 'Enter your current password.');
    setRecBusy(true);
    try {
      const key = await regenerateRecoveryKey(recPassword);
      setRecPassword('');
      setRecKey(key);
    } catch (e) {
      toast.error('Could not generate key', (e as Error).message);
    } finally {
      setRecBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Change password */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Lock size={14} className="text-accent" /> Change master password</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Current"><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" autoComplete="off" /></Field>
          <Field label="New"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password" autoComplete="off" /></Field>
          <Field label="Confirm"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new" autoComplete="off" /></Field>
        </div>
        <Button className="mt-3" variant="primary" loading={pwBusy} onClick={submitPassword}><Save size={15} /> Update password</Button>
      </div>

      {/* Hint */}
      <div className="border-t border-border pt-5">
        <p className="mb-2 text-sm font-medium">Password hint</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="A gentle reminder shown on the forgot-password screen" />
          <Button onClick={saveHint} className="sm:w-auto"><Save size={15} /> Save</Button>
        </div>
      </div>

      {/* Recovery key */}
      <div className="border-t border-border pt-5">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-medium"><KeyRound size={14} className="text-accent" /> Recovery key</p>
        <p className="mb-3 text-xs text-muted">Generate a new recovery key (this invalidates the previous one). Enter your current password to reveal it.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="password" value={recPassword} onChange={(e) => setRecPassword(e.target.value)} placeholder="Current password" autoComplete="off" />
          <Button onClick={regenerate} loading={recBusy} className="sm:w-auto"><KeyRound size={15} /> Regenerate</Button>
        </div>
      </div>

      <RecoveryKeyDialog
        open={!!recKey}
        recoveryKey={recKey ?? ''}
        onClose={() => setRecKey(null)}
        title="Your new recovery key"
      />
    </div>
  );
}
