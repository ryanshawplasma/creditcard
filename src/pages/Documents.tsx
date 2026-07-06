import { useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, FileArchive, Upload, Trash2, Download, ExternalLink, File } from 'lucide-react';
import { useData } from '@/store/data';
import { useToast } from '@/components/ui/Toast';
import { Page, PageHeader } from '@/components/ui/Page';
import { Button, Select, Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { fmtDate } from '@/lib/format';
import { addDocument, deleteDocument } from '@/lib/repo';
import { readFileAsDataURL } from '@/lib/utils';
import type { DocumentKind } from '@/types';

const KINDS: DocumentKind[] = ['Statement', 'Agreement', 'KYC', 'Receipt', 'Photo', 'Other'];

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  if (mime.includes('zip') || mime.includes('compressed')) return FileArchive;
  return File;
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const { documents, cards, cardsById } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>('Statement');
  const [cardId, setCardId] = useState('');
  const [filterKind, setFilterKind] = useState('all');

  const filtered = useMemo(
    () => [...documents]
      .filter((d) => filterKind === 'all' || d.kind === filterKind)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [documents, filterKind],
  );

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) { toast.error('File too large', `${file.name} exceeds 8 MB.`); continue; }
      const dataUrl = await readFileAsDataURL(file);
      await addDocument({ name: file.name, kind, mime: file.type || 'application/octet-stream', size: file.size, dataUrl, cardId: cardId || undefined });
    }
    toast.success('Uploaded', `${files.length} document${files.length > 1 ? 's' : ''} added to your vault.`);
    if (fileRef.current) fileRef.current.value = '';
  }

  function openDoc(dataUrl: string, name: string, download = false) {
    const a = document.createElement('a');
    a.href = dataUrl;
    if (download) a.download = name;
    else a.target = '_blank';
    a.click();
  }

  return (
    <Page>
      <PageHeader title="Documents" subtitle="Statements, agreements, KYC and receipts — stored locally" />

      {/* Upload panel */}
      <div
        className="mb-6 rounded-2xl border border-dashed border-border bg-surface p-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent"><Upload size={20} /></div>
          <div className="flex-1">
            <p className="text-sm font-medium">Drag & drop files here, or browse</p>
            <p className="text-xs text-subtle">PDF, images, up to 8 MB each. Stored on this device only.</p>
          </div>
          <Select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} className="w-auto min-w-[130px]">
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </Select>
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">No linked card</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button variant="primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Browse</Button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setFilterKind('all')} className={`rounded-full border px-3 py-1.5 text-xs transition ${filterKind === 'all' ? 'border-accent bg-accent/12 text-accent' : 'border-border text-muted hover:text-fg'}`}>All ({documents.length})</button>
        {KINDS.map((k) => {
          const count = documents.filter((d) => d.kind === k).length;
          if (!count) return null;
          return <button key={k} onClick={() => setFilterKind(k)} className={`rounded-full border px-3 py-1.5 text-xs transition ${filterKind === k ? 'border-accent bg-accent/12 text-accent' : 'border-border text-muted hover:text-fg'}`}>{k} ({count})</button>;
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText size={26} />} title="No documents yet" description="Upload statements, card agreements, KYC or receipts to keep everything in one place." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const Icon = iconFor(d.mime);
            const isImg = d.mime.startsWith('image/');
            return (
              <div key={d.id} className="group card-surface overflow-hidden">
                <div className="flex h-32 items-center justify-center border-b border-border bg-surface-2">
                  {isImg ? <img src={d.dataUrl} alt={d.name} className="h-full w-full object-cover" /> : <Icon size={40} className="text-subtle" />}
                </div>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-[11px] text-subtle">{sizeLabel(d.size)} · {fmtDate(d.createdAt.slice(0, 10))}</p>
                    </div>
                    <Badge tone="accent">{d.kind}</Badge>
                  </div>
                  {d.cardId && cardsById[d.cardId] && <p className="mt-1.5 truncate text-[11px] text-muted">🔗 {cardsById[d.cardId].name}</p>}
                  <div className="mt-3 flex gap-1.5">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => openDoc(d.dataUrl, d.name)}><ExternalLink size={13} /> Open</Button>
                    <Button size="sm" variant="ghost" onClick={() => openDoc(d.dataUrl, d.name, true)}><Download size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={async () => { await deleteDocument(d.id); toast.info('Document deleted'); }}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
