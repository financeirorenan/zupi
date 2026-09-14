import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, Search, Receipt, Heart, User, MapPin, ShoppingCart, Bell, LogOut, Store, ShieldCheck, ChevronDown } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCity } from "@/context/CityContext";
import { api, fmtDateTime } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

function NotificationsBell() {
  const [data, setData] = useState(null);
  const load = () => api.get("/notifications").then((r) => setData(r.data)).catch(() => {});
  return (
    <Popover onOpenChange={(o) => o && load()}>
      <PopoverTrigger asChild>
        <button data-testid="notifications-button" className="relative w-11 h-11 rounded-xl hover:bg-orange-50 flex items-center justify-center">
          <Bell className="w-5 h-5 text-slate-700" />
          {data?.unread > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-orange-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{data.unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-bold text-sm">Notificações</p>
          {data?.unread > 0 && (
            <button data-testid="notifications-read-all" className="text-xs text-orange-600 font-semibold" onClick={() => api.post("/notifications/read-all").then(load)}>
              Marcar lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!data?.items?.length && <p className="text-sm text-slate-400 text-center py-8">Nenhuma notificação</p>}
          {data?.items?.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${!n.read ? "bg-orange-50/60" : ""}`}>
              <p className="text-sm font-semibold text-slate-800">{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">{fmtDateTime(n.created_at)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const NAV = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/buscar", icon: Search, label: "Buscar" },
  { to: "/pedidos", icon: Receipt, label: "Pedidos" },
  { to: "/favoritos", icon: Heart, label: "Favoritos" },
  { to: "/perfil", icon: User, label: "Perfil" },
];

export default function CustomerLayout({ children }) {
  const { user, logout } = useAuth();
  const { city, setCity, cities } = useCity();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-3 sm:px-4 h-16">
          <Link to="/" data-testid="nav-logo"><Logo small /></Link>
          <Popover>
            <PopoverTrigger asChild>
              <button data-testid="city-selector" className="flex items-center gap-1.5 px-3 h-11 rounded-xl hover:bg-orange-50 text-sm font-semibold text-slate-700 max-w-[150px] sm:max-w-none">
                <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="truncate">{city || "Sua cidade"}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              {cities.map((c) => (
                <button
                  key={c.id}
                  data-testid={`city-option-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  onClick={() => setCity(c.name)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${city === c.name ? "bg-orange-50 text-orange-700" : "hover:bg-slate-50"}`}
                >
                  {c.name} — {c.state}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="flex-1" />
          <Link to="/carrinho" data-testid="cart-button" className="relative w-11 h-11 rounded-xl hover:bg-orange-50 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-slate-700" />
            {count > 0 && (
              <span data-testid="cart-count-badge" className="absolute top-1 right-1 bg-orange-600 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">{count}</span>
            )}
          </Link>
          {user && <NotificationsBell />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="user-menu-button" className="flex items-center gap-2 h-11 px-2 sm:px-3 rounded-xl hover:bg-orange-50">
                  <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">
                    {user.name?.[0]?.toUpperCase()}
                  </span>
                  <span className="hidden sm:block text-sm font-semibold max-w-[100px] truncate">{user.name?.split(" ")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user.role === "restaurant" && (
                  <DropdownMenuItem onClick={() => navigate("/lojista")} data-testid="menu-merchant-panel">
                    <Store className="w-4 h-4 mr-2" /> Painel do Restaurante
                  </DropdownMenuItem>
                )}
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin-panel">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Painel Admin Zupi
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("/pedidos")} data-testid="menu-my-orders">Meus pedidos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/perfil")} data-testid="menu-profile">Minha conta</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/entrar" data-testid="login-link" className="h-11 px-4 rounded-xl bg-orange-600 text-white text-sm font-bold flex items-center hover:bg-orange-700 transition-colors">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="pb-24 md:pb-10">{children}</main>

      <footer className="hidden md:block bg-[#121212] text-slate-300 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-3 gap-8">
          <div>
            <Logo light />
            <p className="text-sm mt-3 text-slate-400">O delivery da sua cidade. Peça dos restaurantes que você conhece.</p>
            <p className="text-xs mt-2 text-orange-400 font-semibold">Apenas R$ 2,00 por pedido para o restaurante. Sem mensalidade.</p>
          </div>
          <div className="text-sm space-y-2">
            <p className="font-bold text-white">Zupi</p>
            <p>Termos de uso</p>
            <p>Política de privacidade (LGPD)</p>
          </div>
          <div className="text-sm space-y-2">
            <p className="font-bold text-white">Parceiros</p>
            <Link to="/cadastrar?tipo=restaurante" className="block hover:text-orange-400" data-testid="footer-be-merchant">Cadastre seu restaurante</Link>
            <Link to="/lojista" className="block hover:text-orange-400">Painel do lojista</Link>
          </div>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t h-16 flex items-stretch shadow-[0_-4px_20px_rgba(0,0,0,0.06)]" data-testid="bottom-navigation">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={`bottom-nav-${label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}`}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${isActive ? "text-orange-600" : "text-slate-400"}`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
