import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import { StatCard } from "@/pages/merchant/MerchantDashboard";
import { Loading } from "@/components/States";
import { api, fmtBRL } from "@/lib/api";
import { TrendingUp, Zap, ShoppingBag, Receipt, Store, Users, MapPin, XCircle, Loader } from "lucide-react";

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Dashboard Executivo" subtitle="Visão geral da operação Zupi Delivery">
      {!data ? <Loading /> : (
        <div className="space-y-5">
          <div className="bg-[#121212] rounded-2xl p-6 text-white flex flex-wrap gap-8 items-center" data-testid="admin-hero">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Hoje</p>
              <p className="font-display font-extrabold text-3xl mt-1">{data.today.orders} pedidos</p>
              <p className="text-sm text-slate-400">GMV {fmtBRL(data.today.gmv)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Receita Zupi hoje</p>
              <p className="font-display font-extrabold text-3xl mt-1 text-orange-400">{fmtBRL(data.today.revenue)}</p>
              <p className="text-sm text-slate-400">R$ 2,00 por pedido</p>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Receita acumulada</p>
              <p className="font-display font-extrabold text-3xl mt-1 text-emerald-400">{fmtBRL(data.zupi_revenue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <StatCard icon={TrendingUp} label="GMV total" value={fmtBRL(data.gmv)} testid="adm-gmv" />
            <StatCard icon={ShoppingBag} label="Pedidos" value={data.orders} sub={`${data.cancelled} cancelados (${data.cancel_rate}%)`} testid="adm-orders" />
            <StatCard icon={Receipt} label="Ticket médio" value={fmtBRL(data.ticket_avg)} testid="adm-ticket" />
            <StatCard icon={Store} label="Restaurantes" value={data.restaurants} sub={`${data.active_restaurants} ativos • ${data.pending_restaurants} pendentes`} testid="adm-restaurants" />
            <StatCard icon={Users} label="Clientes" value={data.users} testid="adm-users" />
            <StatCard icon={MapPin} label="Cidades" value={data.cities} testid="adm-cities" />
            <StatCard icon={Loader} label="Em andamento" value={data.in_progress} testid="adm-in-progress" />
            <StatCard icon={Zap} label="Receita Zupi" value={fmtBRL(data.zupi_revenue)} sub="R$2,00/pedido" testid="adm-revenue" />
            <StatCard icon={XCircle} label="Cancelamento" value={`${data.cancel_rate}%`} testid="adm-cancel" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-display font-bold text-slate-900 mb-4">GMV — últimos 14 dias</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.by_day}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={45} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v, name) => [name === "gmv" ? fmtBRL(v) : v, name === "gmv" ? "GMV" : "Pedidos"]} />
                  <Area dataKey="gmv" stroke="#FF5722" fill="#FF5722" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-display font-bold text-slate-900 mb-4">Pedidos — últimos 14 dias</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.by_day}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} pedidos`, ""]} />
                  <Area dataKey="orders" stroke="#10B981" fill="#10B981" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-display font-bold text-slate-900 mb-3">Ranking de restaurantes</h3>
              <div className="space-y-2">
                {data.top_restaurants.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3" data-testid={`top-restaurant-${i}`}>
                    <span className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 font-bold text-xs flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{r.name}</span>
                    <span className="text-xs text-slate-400">{r.orders} pedidos</span>
                    <span className="text-sm font-bold text-slate-900">{fmtBRL(r.gmv)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-display font-bold text-slate-900 mb-3">Ranking de cidades</h3>
              <div className="space-y-2">
                {data.by_city.map((c, i) => (
                  <div key={c.city} className="flex items-center gap-3" data-testid={`top-city-${i}`}>
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-700">{c.city}</span>
                    <span className="text-xs text-slate-400">{c.orders} pedidos</span>
                    <span className="text-sm font-bold text-slate-900">{fmtBRL(c.gmv)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
