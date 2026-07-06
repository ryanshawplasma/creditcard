import { useMemo, useState } from 'react';
import { Sparkles, ClipboardType, Image as ImageIcon, Upload, Wand2, Check, Loader2, X } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI, type CardDraft } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button, Segmented, Textarea, Badge } from '@/components/ui/primitives';
import { parseCardText, extractFromImage, type CardExtract } from '@/lib/extract';
import { readFileAsDataURL } from '@/lib/utils';

const SAMPLE = `Dear Customer, your HDFC Bank Regalia Credit Card ending 4589 has a Total Amount Due of Rs 12,340.00. Minimum Amount Due Rs 620. Payment Due Date 06/07/2026. Avl Credit Limit Rs 3,71,500.`;

export function SmartImportModal() {
  const { smartImport, closeSmartImport, openCardModal } = useUI();
  const { banks } = useData();
  const toast = useToast();

  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [imageExtract, setImageExtract] = useState<CardExtract | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; status: string } | null>(null);

  const textExtract = useMemo(() => (text.trim() ? parseCardText(text) : null), [text]);
  const extract = mode === 'text' ? textExtract : imageExtract;

  function reset() {
    setText(''); setImage(undefined); setImageExtract(null); setProgress(null); setBusy(false);
  }
  function handleClose() { reset(); closeSmartImport(); }

  async function handleImage(file?: File) {
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    setImage(dataUrl);
    setImageExtract(null);
    setBusy(true);
    setProgress({ pct: 0, status: 'starting' });
    try {
      const result = await extractFromImage(file, (pct, status) => setProgress({ pct, status }));
      setImageExtract(result);
    } catch (e) {
      toast.error('Could not read the image', (e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function resolveBank(name?: string): { bankId?: string; newBankName?: string } {
    if (!name) return {};
    const hit = banks.find(
      (b) => b.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes((b.shortName ?? b.name).toLowerCase()),
    );
    return hit ? { bankId: hit.id } : { newBankName: name };
  }

  function proceed() {
    if (!extract) return;
    const bank = resolveBank(extract.bankName);
    const draft: CardDraft = {
      name: extract.name,
      network: extract.network,
      last4: extract.last4,
      fullCardNumber: extract.fullCardNumber,
      creditLimit: extract.creditLimit,
      openingBalance: extract.openingBalance,
      dueDay: extract.dueDay,
      billingDay: extract.billingDay,
      statementDay: extract.statementDay,
      expiryMonth: extract.expiryMonth,
      expiryYear: extract.expiryYear,
      rewardProgram: extract.rewardProgram,
      image: mode === 'image' ? image : undefined,
      ...bank,
    };
    const count = extract.found.filter((f) => !/no fields/i.test(f)).length;
    handleClose();
    openCardModal(undefined, draft);
    toast.success(
      count ? `Detected ${count} field${count > 1 ? 's' : ''}` : 'Ready to edit',
      'Review everything and save the card.',
    );
  }

  const detected = extract?.found.filter((f) => !/no fields/i.test(f)) ?? [];
  const canProceed = mode === 'text' ? !!text.trim() : !!image && !busy;

  return (
    <Modal
      open={smartImport.open}
      onClose={handleClose}
      size="lg"
      title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-accent" /> Smart add a card</span>}
      description="Paste a bank SMS / statement, or drop a photo of the card — we'll fill in what we can. Everything is processed on your device."
      footer={
        <>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={proceed} disabled={!canProceed || busy}>
            <Wand2 size={15} /> Review &amp; edit card
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'text', label: <span className="flex items-center gap-1.5"><ClipboardType size={14} /> Paste text</span> },
            { value: 'image', label: <span className="flex items-center gap-1.5"><ImageIcon size={14} /> Card photo</span> },
          ]}
        />

        {mode === 'text' ? (
          <div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your bank SMS or statement text here…"
              className="min-h-[140px] font-mono text-xs"
              autoFocus
            />
            <button onClick={() => setText(SAMPLE)} className="mt-1.5 text-xs text-accent hover:underline">
              Try a sample message
            </button>
          </div>
        ) : (
          <div>
            {image ? (
              <div className="relative overflow-hidden rounded-xl border border-border">
                <img src={image} alt="card" className="max-h-56 w-full object-contain bg-surface-2" />
                <button onClick={() => { setImage(undefined); setImageExtract(null); }} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70">
                  <X size={16} />
                </button>
                {busy && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                    <Loader2 size={22} className="animate-spin" />
                    <p className="text-sm font-medium">Reading card… {progress?.pct ?? 0}%</p>
                    <p className="text-xs capitalize text-white/70">{progress?.status ?? 'processing'}</p>
                  </div>
                )}
              </div>
            ) : (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files?.[0]); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center transition hover:border-accent/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent"><Upload size={22} /></div>
                <p className="text-sm font-medium">Drop a card photo, or click to browse</p>
                <p className="text-xs text-subtle">OCR runs locally in your browser — the image never leaves this device.</p>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
              </label>
            )}
          </div>
        )}

        {/* Detected fields */}
        {extract && (
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
              <Check size={14} className="text-success" /> Detected
            </p>
            {detected.length ? (
              <div className="flex flex-wrap gap-1.5">
                {detected.map((f, i) => <Badge key={i} tone="accent">{f}</Badge>)}
              </div>
            ) : (
              <p className="text-xs text-subtle">
                Nothing recognised automatically{mode === 'image' ? ' (photos of embossed cards can be hard to read)' : ''} — you can still continue and fill the details in manually.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
