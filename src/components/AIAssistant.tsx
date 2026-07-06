import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, User } from 'lucide-react';
import { Sheet } from '@/components/ui/Modal';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { askAI, AI_SUGGESTIONS, type AIAnswer } from '@/lib/ai';
import { money, percent } from '@/lib/format';
import { utilization } from '@/lib/analytics';
import { maskCardNumber } from '@/lib/crypto';
import { CARD_GRADIENTS } from '@/lib/format';

interface Turn {
  role: 'user' | 'ai';
  text: string;
  answer?: AIAnswer;
}

export function AIAssistant() {
  const { aiOpen, setAiOpen } = useUI();
  const { cards, owners, banks, dueItems, ownersById } = useData();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, thinking]);

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: q }]);
    setThinking(true);
    // Small delay to feel responsive/considered.
    setTimeout(() => {
      const answer = askAI(q, { cards, owners, banks, dueItems });
      setTurns((t) => [...t, { role: 'ai', text: answer.text, answer }]);
      setThinking(false);
    }, 420);
  }

  return (
    <Sheet open={aiOpen} onClose={() => setAiOpen(false)} width="max-w-md" title={
      <span className="flex items-center gap-2"><Sparkles size={17} className="text-accent" /> AI Assistant</span>
    }>
      <div className="flex h-full flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface-2 p-4">
                <p className="text-sm text-fg">Hi 👋 I can answer questions about your portfolio — instantly, and fully offline. Try one of these:</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => submit(s)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={t.role === 'user' ? 'flex justify-end' : 'flex gap-2.5'}>
              {t.role === 'ai' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent"><Sparkles size={15} /></div>
              )}
              <div className={t.role === 'user' ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2.5 text-sm text-accent-fg' : 'max-w-[85%] space-y-2.5'}>
                {t.role === 'user' ? (
                  <span>{t.text}</span>
                ) : (
                  <>
                    <div className="rounded-2xl rounded-tl-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-fg">{t.text}</div>
                    {t.answer?.bullets && t.answer.bullets.length > 0 && (
                      <ul className="space-y-1 pl-1">
                        {t.answer.bullets.map((b, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs text-muted"><span className="h-1 w-1 rounded-full bg-accent" /> {b}</li>
                        ))}
                      </ul>
                    )}
                    {t.answer?.cards && t.answer.cards.length > 0 && (
                      <div className="space-y-1.5">
                        {t.answer.cards.slice(0, 4).map((c) => (
                          <div key={c.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2">
                            <div className="h-7 w-11 shrink-0 rounded-md" style={{ background: CARD_GRADIENTS[c.color] }} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{c.name}</p>
                              <p className="truncate text-[11px] text-subtle">{maskCardNumber(c.last4)} · {ownersById[c.ownerId]?.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums">{money(c.currentBalance)}</p>
                              <p className="text-[11px] text-subtle">{percent(utilization(c))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {t.role === 'user' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted"><User size={14} /></div>
              )}
            </motion.div>
          ))}

          {thinking && (
            <div className="flex gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent"><Sparkles size={15} /></div>
              <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface-2 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-subtle" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-1.5 focus-within:border-accent/60">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit(input)}
              placeholder="Ask about your cards…"
              className="h-8 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
            />
            <button onClick={() => submit(input)} disabled={!input.trim()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg disabled:opacity-40">
              <Send size={15} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-subtle">Answers computed locally from your data — nothing is sent to any server.</p>
        </div>
      </div>
    </Sheet>
  );
}
