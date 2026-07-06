import { motion } from 'framer-motion';
import { Wifi, Star } from 'lucide-react';
import type { Bank, Card } from '@/types';
import { CARD_GRADIENTS, NETWORK_META } from '@/lib/format';
import { maskCardNumber } from '@/lib/crypto';
import { cn } from '@/lib/utils';

interface Props {
  card: Card;
  bank?: Bank;
  ownerName?: string;
  className?: string;
  interactive?: boolean;
  compact?: boolean;
}

export function CardVisual({ card, bank, ownerName, className, interactive, compact }: Props) {
  const gradient = CARD_GRADIENTS[card.color] ?? CARD_GRADIENTS.midnight;
  const net = NETWORK_META[card.network];
  const dim = card.status !== 'Active';

  return (
    <motion.div
      whileHover={interactive ? { y: -4, rotateX: 3, rotateY: -3 } : undefined}
      style={{ background: card.image ? undefined : gradient, transformStyle: 'preserve-3d' }}
      className={cn(
        'relative aspect-[1.586] w-full overflow-hidden rounded-2xl p-4 text-white shadow-lift',
        dim && 'opacity-60 grayscale',
        className,
      )}
    >
      {card.image && <img src={card.image} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />}
      {/* Sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/15" />
      <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">{bank?.name ?? 'Bank'}</p>
            <p className={cn('truncate font-semibold', compact ? 'text-sm' : 'text-[15px]')}>{card.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {card.pinned && <Star size={14} className="fill-white/80 text-white/80" />}
            <span className="text-lg" aria-hidden>{card.icon}</span>
          </div>
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-8 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-500/80 shadow-inner" />
            <Wifi size={16} className="rotate-90 text-white/70" />
          </div>
        )}

        <div>
          <p className={cn('font-mono tracking-[0.18em] text-white/95', compact ? 'text-xs' : 'text-[15px]')}>
            {maskCardNumber(card.last4)}
          </p>
          <div className="mt-1.5 flex items-end justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/50">Card holder</p>
              <p className="truncate text-xs font-medium">{ownerName ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/50">Expires</p>
              <p className="text-xs font-medium tabular-nums">
                {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
              </p>
            </div>
            <p className="text-sm font-bold italic tracking-tight text-white/95">{net?.label ?? card.network}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
