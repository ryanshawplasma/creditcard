import { motion } from 'framer-motion';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Vault } from 'lucide-react';
import { useAuth } from './store/auth';
import { DataProvider } from './store/data';
import { Login } from './pages/Login';
import { AppShell } from './components/layout/AppShell';
import { RecoveryKeyModal } from './components/RecoveryKeyModal';
import { Dashboard } from './pages/Dashboard';
import { CardsPage } from './pages/Cards';
import { PeoplePage } from './pages/People';
import { CalendarPage } from './pages/Calendar';
import { PaymentsPage } from './pages/Payments';
import { RemindersPage } from './pages/Reminders';
import { RewardsPage } from './pages/Rewards';
import { AnalyticsPage } from './pages/Analytics';
import { DocumentsPage } from './pages/Documents';
import { SettingsPage } from './pages/Settings';

function Splash() {
  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-glow">
          <Vault size={30} />
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full w-1/2 rounded-full bg-accent" animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }} />
        </div>
      </motion.div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  // Keyed by pathname so each navigation remounts and replays the enter
  // animation. We deliberately avoid `AnimatePresence mode="wait"` here: an
  // interrupted exit animation could leave it waiting forever and silently
  // stall navigation. Enter-only transitions can never get stuck.
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
  const { status } = useAuth();

  if (status === 'loading') return <Splash />;
  if (status !== 'authenticated') return <Login />;

  return (
    <DataProvider>
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
      <RecoveryKeyModal />
    </DataProvider>
  );
}
