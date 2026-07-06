import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CardNetwork } from '@/types';

interface ModalState {
  open: boolean;
  id?: string; // entity id when editing / preselecting
}

/** A partial card the smart-import flow hands to the editor for review. */
export interface CardDraft {
  name?: string;
  bankId?: string;
  newBankName?: string;
  network?: CardNetwork;
  last4?: string;
  fullCardNumber?: string;
  creditLimit?: number;
  openingBalance?: number;
  dueDay?: number;
  billingDay?: number;
  statementDay?: number;
  expiryMonth?: number;
  expiryYear?: number;
  image?: string;
  notes?: string;
  rewardProgram?: string;
}

interface CardModalState extends ModalState {
  draft?: CardDraft;
}

interface UICtx {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;

  cardModal: CardModalState;
  openCardModal: (id?: string, draft?: CardDraft) => void;
  closeCardModal: () => void;

  smartImport: ModalState;
  openSmartImport: () => void;
  closeSmartImport: () => void;

  paymentModal: ModalState;
  openPaymentModal: (cardId?: string) => void;
  closePaymentModal: () => void;

  ownerModal: ModalState;
  openOwnerModal: (id?: string) => void;
  closeOwnerModal: () => void;

  txnModal: ModalState;
  openTxnModal: (cardId?: string) => void;
  closeTxnModal: () => void;
}

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cardModal, setCardModal] = useState<CardModalState>({ open: false });
  const [smartImport, setSmartImport] = useState<ModalState>({ open: false });
  const [paymentModal, setPaymentModal] = useState<ModalState>({ open: false });
  const [ownerModal, setOwnerModal] = useState<ModalState>({ open: false });
  const [txnModal, setTxnModal] = useState<ModalState>({ open: false });

  const value = useMemo<UICtx>(
    () => ({
      commandOpen,
      setCommandOpen,
      aiOpen,
      setAiOpen,
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
      cardModal,
      openCardModal: (id, draft) => setCardModal({ open: true, id, draft }),
      closeCardModal: () => setCardModal({ open: false }),
      smartImport,
      openSmartImport: () => setSmartImport({ open: true }),
      closeSmartImport: () => setSmartImport({ open: false }),
      paymentModal,
      openPaymentModal: (cardId) => setPaymentModal({ open: true, id: cardId }),
      closePaymentModal: () => setPaymentModal({ open: false }),
      ownerModal,
      openOwnerModal: (id) => setOwnerModal({ open: true, id }),
      closeOwnerModal: () => setOwnerModal({ open: false }),
      txnModal,
      openTxnModal: (cardId) => setTxnModal({ open: true, id: cardId }),
      closeTxnModal: () => setTxnModal({ open: false }),
    }),
    [commandOpen, aiOpen, sidebarCollapsed, mobileNavOpen, cardModal, smartImport, paymentModal, ownerModal, txnModal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
