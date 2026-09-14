import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { api, fmtBRL } from "@/lib/api";
import { TrendingUp, ShoppingBag, Receipt, Zap, Star, Loader } from "lucide-react";

const PERIODS = [
  { days: 1, label: "Hoje" },
  { days: 2, label: "Ontem" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
];

export function StatCard({ icon: Icon, label, value, sub, testid }) {
  return (
    <div className="bg-white rounded-2xl border p-5" data-testid={testid}>
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="w-4 h-4 text-orange-500" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display font-extrabold text-2xl text-slate-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function MerchantDashboard() {
  const [days, setDays] = useState(1);
  const [data, setData] = useState(null);
  const [noRestaurant, setNoRestaurant] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    api.get("/merchant/dashboard", { params: { days } })
      .then((r) => setData(r.data))
      .catch((e) => { if (e?.response?.status === 404) setNoRestaurant(true); });
  }, [days]);

  if (noRestaurant) {
    return (
      <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Bem-vindo ao Zupi!" subtitle="Vamos cadastrar seu restaurante">
        <div className="bg-white rounded-2xl border p-8 max-w-lg text-center mx-auto mt-10" data-testid="onboarding-cta">
          <p className="font-display font-extrabold text-xl text-slate-900">Quase lá!</p>
          <p className="text-sm text-slate-500 mt-2">Complete o cadastro do seu restaurante para aparecer no app. Apenas R$ 2,00 por pedido, sem mensalidade.</p>
          <button onClick={() => navigate("/lojista/configuracoes")} data-testid="go-onboarding" className="mt-5 h-12 px-8 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700">
            Completar cadastro
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="top"
      menu={MERCHANT_MENU}
      title="Dashboard"
      subtitle="Visão geral das suas vendas"
      actions={
        <div className="flex gap-1.5 bg-white border rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              data-testid={`period-${p.days}`}
              onClick={() => setDays(p.days)}
              className={`h-9 px-3 rounded-lg text-xs font-bold ${days === p.days ? "bg-orange-600 text-white" : "text-slate-500"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {!data ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard icon={TrendingUp} label="Vendas" value={fmtBRL(data.gross)} testid="stat-gross" />
            <StatCard icon={ShoppingBag} label="Pedidos" value={data.orders} sub={`${data.cancelled} cancelados`} testid="stat-orders" />
            <StatCard icon={Receipt} label="Ticket médio" value={fmtBRL(data.ticket_avg)} testid="stat-ticket" />
            <StatCard icon={Zap} label="Taxa Zupi" value={fmtBRL(data.zupi_fees)} sub="R$ 2,00 por pedido" testid="stat-zupi-fee" />
            <StatCard icon={Loader} label="Em andamento" value={data.in_progress} testid="stat-in-progress" />
            <StatCard icon={Star} label="Avaliação" value={data.rating ? data.rating.toFixed(1) : "—"} sub={`${data.rating_count} avaliações`} testid="stat-rating" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-display font-bold text-slate-900 mb-4">Pedidos por horário</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.by_hour}>
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={25} />
                  <Tooltip formatter={(v) => [`${v} pedidos`, ""]} labelFormatter={(h) => `${h}h`} />
                  <Bar dataKey="orders" fill="#FF5722" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-display font-bold text-slate-900 mb-4">Produtos mais vendidos</h3>
              {data.top_products.length === 0 && <p className="text-sm text-slate-400">Sem vendas no período.</p>}
              <div className="space-y-3">
                {data.top_products.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3" data-testid={`top-product-${i}`}>
                    <span className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 font-bold text-xs flex items-center justify-center">{i + 1}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                    <span className="text-sm font-bold text-slate-900">{p.qty} un</span>
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
