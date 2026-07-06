import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface ModalState {
  open: boolean;
  id?: string; // entity id when editing / preselecting
}

interface UICtx {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  cardModal: ModalState;
  openCardModal: (id?: string) => void;
  closeCardModal: () => void;

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
  const [cardModal, setCardModal] = useState<ModalState>({ open: false });
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
      cardModal,
      openCardModal: (id) => setCardModal({ open: true, id }),
      closeCardModal: () => setCardModal({ open: false }),
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
    [commandOpen, aiOpen, sidebarCollapsed, cardModal, paymentModal, ownerModal, txnModal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
