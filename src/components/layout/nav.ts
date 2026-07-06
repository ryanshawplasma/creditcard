import {
  LayoutDashboard,
  CreditCard,
  Users,
  CalendarDays,
  Wallet,
  Bell,
  Gift,
  BarChart3,
  FileText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cards', label: 'Cards', icon: CreditCard },
  { to: '/people', label: 'People', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((n) => [n.to, n.label]),
);
