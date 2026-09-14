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

export default function DashboardLayout({ menu, title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    navigate("/");
  };

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
