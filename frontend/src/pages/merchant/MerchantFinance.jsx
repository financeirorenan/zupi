import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { StatCard } from "@/pages/merchant/MerchantDashboard";
import { Loading } from "@/components/States";
import { api, fmtBRL, fmtDateTime } from "@/lib/api";
import { TrendingUp, Percent, Bike, Zap, Wallet } from "lucide-react";

export default function MerchantFinance() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get("/merchant/finance", { params: { days } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [days]);

  return (
    <DashboardLayout variant="top"
      menu={MERCHANT_MENU}
      title="Financeiro"
      subtitle="Transparência total: só R$ 2,00 por pedido"
      actions={
        <div className="flex gap-1.5 bg-white border rounded-xl p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} data-testid={`finance-period-${d}`} onClick={() => setDays(d)} className={`h-9 px-3 rounded-lg text-xs font-bold ${days === d ? "bg-orange-600 text-white" : "text-slate-500"}`}>{d} dias</button>
          ))}
        </div>
      }
    >
      {!data ? <Loading /> : (
        <div className="space-y-5">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-5 text-white flex flex-wrap items-center gap-4" data-testid="finance-net-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-100">Valor líquido no período</p>
              <p className="font-display font-extrabold text-3xl">{fmtBRL(data.net)}</p>
            </div>
            <div className="flex-1" />
            <span className="bg-white/20 text-xs font-bold px-3 py-1.5 rounded-full">Taxa Zupi: {fmtBRL(data.platform_fee)}/pedido</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard icon={TrendingUp} label="Vendas brutas" value={fmtBRL(data.gross)} testid="fin-gross" />
            <StatCard icon={Percent} label="Descontos/cupons" value={fmtBRL(data.discounts)} testid="fin-discounts" />
            <StatCard icon={Bike} label="Taxas de entrega" value={fmtBRL(data.delivery_fees)} testid="fin-delivery" />
            <StatCard icon={Zap} label="Taxa Zupi" value={fmtBRL(data.zupi_fees)} sub={`${data.orders} pedidos`} testid="fin-zupi" />
            <StatCard icon={Wallet} label="Pedidos" value={data.orders} testid="fin-orders" />
          </div>

          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-display font-bold text-slate-900 mb-4">Vendas por dia</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.by_day}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(8)} />
                <YAxis tick={{ fontSize: 10 }} width={45} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v, name) => [name === "gross" ? fmtBRL(v) : v, name === "gross" ? "Vendas" : "Pedidos"]} />
                <Area dataKey="gross" stroke="#FF5722" fill="#FF5722" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border overflow-x-auto">
            <h3 className="font-display font-bold text-slate-900 p-5 pb-2">Extrato de taxas</h3>
            <table className="w-full text-sm min-w-[480px]" data-testid="transactions-table">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b">
                  <th className="px-5 py-2">Data</th><th className="px-5 py-2">Descrição</th><th className="px-5 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 text-slate-500">{fmtDateTime(t.created_at)}</td>
                    <td className="px-5 py-2.5">{t.description}</td>
                    <td className={`px-5 py-2.5 text-right font-bold ${t.amount < 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {t.amount < 0 ? "+" : "-"}{fmtBRL(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))}
                {data.transactions.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">Sem movimentações no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
