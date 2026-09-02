import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  FileText,
  Gift,
  LandPlot,
  LayoutDashboard,
  Lock,
  Medal,
  Package,
  Percent,
  Receipt,
  ScrollText,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const NAV_ICON: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/agenda": CalendarDays,
  "/admin/canchas": LandPlot,
  "/admin/clientes": Users,
  "/admin/caja": Wallet,
  "/admin/inventario": Package,
  "/admin/gastos": Receipt,
  "/admin/empleados": UserCog,
  "/admin/auditoria": ScrollText,
  "/admin/torneos": Trophy,
  "/admin/ranking": Medal,
  "/admin/promociones": Percent,
  "/admin/notificaciones": Bell,
  "/admin/analitica": BarChart3,
  "/admin/alertas": AlertTriangle,
  "/admin/reportes": FileText,
};

export const LockIcon = Lock;
export const GiftIcon = Gift;
export const SparklesIcon = Sparkles;
