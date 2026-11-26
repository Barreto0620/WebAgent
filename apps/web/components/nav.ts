import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Workflow,
  Clock,
  Megaphone,
  CalendarClock,
  Boxes,
  Plug,
  BarChart3,
  UserCog,
  ShieldCheck,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Entra numa próxima etapa: aparece com selo "em breve". */
  soon?: boolean;
  /** Papel mínimo para ver o item */
  min?: "supervisor" | "admin";
}

export const NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/atendimento", label: "Atendimento", icon: MessagesSquare },
      { href: "/contatos", label: "Contatos", icon: Users },
    ],
  },
  {
    group: "Automação",
    items: [
      { href: "/automacoes", label: "Mensagens automáticas", icon: Workflow, min: "supervisor" },
      { href: "/respostas-rapidas", label: "Respostas rápidas", icon: Zap, min: "supervisor" },
      { href: "/horarios", label: "Horários", icon: Clock, min: "supervisor" },
      { href: "/campanhas", label: "Campanhas", icon: Megaphone, soon: true },
      { href: "/publicacoes", label: "Publicações", icon: CalendarClock, soon: true },
    ],
  },
  {
    group: "Gestão",
    items: [
      { href: "/sistemas", label: "Sistemas", icon: Boxes },
      { href: "/canais", label: "Canais", icon: Plug, min: "admin" },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, min: "supervisor" },
      { href: "/equipe", label: "Equipe", icon: UserCog, min: "admin" },
      { href: "/privacidade-dados", label: "Privacidade (LGPD)", icon: ShieldCheck, min: "supervisor" },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export const MOBILE_NAV = ["/dashboard", "/atendimento", "/contatos", "/sistemas"];
