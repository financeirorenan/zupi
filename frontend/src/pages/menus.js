import { LayoutDashboard, ClipboardList, UtensilsCrossed, Ticket, Wallet, Star, Settings, Store, Users, MapPin, Megaphone, Bike, Plug, Inbox } from "lucide-react";

export const MERCHANT_MENU = [
  { to: "/lojista", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/lojista/pedidos", icon: ClipboardList, label: "Pedidos" },
  { to: "/lojista/cardapio", icon: UtensilsCrossed, label: "Cardápio" },
  { to: "/lojista/logistica", icon: Bike, label: "Logística" },
  { to: "/lojista/cupons", icon: Ticket, label: "Cupons" },
  { to: "/lojista/financeiro", icon: Wallet, label: "Financeiro" },
  { to: "/lojista/avaliacoes", icon: Star, label: "Avaliações" },
  { to: "/lojista/integracoes", icon: Plug, label: "Integrações" },
  { to: "/lojista/configuracoes", icon: Settings, label: "Configurações" },
];

export const ADMIN_MENU = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/restaurantes", icon: Store, label: "Restaurantes" },
  { to: "/admin/clientes", icon: Users, label: "Clientes" },
  { to: "/admin/cidades", icon: MapPin, label: "Cidades" },
  { to: "/admin/marketing", icon: Megaphone, label: "Marketing" },
  { to: "/admin/leads", icon: Inbox, label: "Leads" },
  { to: "/admin/financeiro", icon: Wallet, label: "Financeiro" },
  { to: "/admin/sistema", icon: Settings, label: "Sistema" },
];
