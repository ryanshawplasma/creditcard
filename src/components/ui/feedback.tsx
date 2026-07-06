import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn, initials } from '@/lib/utils';

// ── Skeleton ─────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}

// ── Progress bar ─────────────────────────────────────────
export function ProgressBar({ value, tone, className }: { value: number; tone?: 'accent' | 'success' | 'warning' | 'danger'; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const auto = clamped >= 90 ? 'danger' : clamped >= 70 ? 'warning' : clamped >= 30 ? 'accent' : 'success';
  const t = tone ?? auto;
  const color = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[t];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  );
}

// ── Progress ring ────────────────────────────────────────
export function Ring({ value, size = 72, stroke = 7, tone, children }: { value: number; size?: number; stroke?: number; tone?: string; children?: ReactNode }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone ?? (clamped >= 90 ? 'rgb(var(--danger))' : clamped >= 70 ? 'rgb(var(--warning))' : 'rgb(var(--accent))');
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────
export function Avatar({ name, src, color, size = 36, className }: { name: string; src?: string; color?: string; size?: number; className?: string }) {
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full flex items-center justify-center font-semibold text-white', className)}
      style={{ width: size, height: size, background: src ? undefined : color ?? 'rgb(var(--accent))', fontSize: size * 0.38 }}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-6 text-center"
    >
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
