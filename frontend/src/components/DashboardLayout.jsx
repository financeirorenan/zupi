import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Menu as MenuIcon } from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function MenuList({ menu, onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {menu.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          data-testid={`sidebar-${label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}`}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              isActive ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/10"
            }`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

const slug = (label) => label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

function TopLayout({ menu, title, subtitle, actions, children, user, doLogout }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col" data-testid="merchant-top-layout">
      <header className="sticky top-0 z-40 bg-[#121212] text-white shadow-lg">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-4">
          <Logo light />
          <div className="flex-1" />
          <div className="hidden sm:block text-right min-w-0">
            <p className="text-sm font-bold truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button onClick={doLogout} data-testid="sidebar-logout" className="h-11 px-4 flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
        <nav className="px-2 sm:px-4 flex gap-1 overflow-x-auto border-t border-white/10 scrollbar-none" data-testid="merchant-top-nav">
          {menu.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`sidebar-${slug(label)}`}
              className={({ isActive }) =>
                `flex-1 min-w-[96px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-3 min-h-[56px] text-xs sm:text-sm font-semibold whitespace-nowrap border-b-[3px] transition-colors ${
                  isActive ? "border-orange-500 text-white bg-white/5" : "border-transparent text-slate-400 hover:text-white hover:bg-white/10"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display font-extrabold text-lg text-slate-900 truncate" data-testid="page-title">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        <div className="flex-1" />
        {actions}
      </div>
      <main className="p-4 sm:p-6 flex-1 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ menu, title, subtitle, actions, children, variant = "side" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    navigate("/");
  };

  if (variant === "top") {
    return <TopLayout menu={menu} title={title} subtitle={subtitle} actions={actions} user={user} doLogout={doLogout}>{children}</TopLayout>;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      <aside className="hidden md:flex w-64 flex-col bg-[#121212] text-white fixed inset-y-0 z-40">
        <div className="p-5"><Logo light /></div>
        <MenuList menu={menu} />
        <div className="p-4 border-t border-white/10">
          <p className="text-sm font-bold truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <button onClick={doLogout} data-testid="sidebar-logout" className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-orange-400 font-semibold">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b px-4 sm:px-6 h-16 flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100" data-testid="mobile-menu-button">
                <MenuIcon className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-[#121212] text-white border-0 flex flex-col">
              <div className="p-5"><Logo light /></div>
              <MenuList menu={menu} onNavigate={() => setOpen(false)} />
              <div className="p-4 border-t border-white/10">
                <button onClick={doLogout} className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-lg text-slate-900 truncate" data-testid="page-title">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
          <div className="flex-1" />
          {actions}
        </header>
        <main className="p-4 sm:p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
