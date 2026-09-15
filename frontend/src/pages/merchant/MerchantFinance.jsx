import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { StatCard } from "@/pages/merchant/MerchantDashboard";
import { Loading } from "@/components/States";
import { api, fmtBRL, fmtDateTime } from "@/lib/api";
import { TrendingUp, Percent, Bike, Zap, Wallet, Printer, CalendarDays } from "lucide-react";
import { printClosing } from "@/lib/printClosing";
import MerchantBilling from "@/pages/merchant/MerchantBilling";

const PAY = { pix: "Pix", card_machine: "Cartão", cash: "Dinheiro", online: "Online" };

function DailyClosing() {
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    api.get("/merchant/finance/closing", { params: { date } }).then((r) => setD(r.data)).catch(() => setD(false));
  }, [date]);
  return (
    <div className="bg-white rounded-2xl border p-5" data-testid="daily-closing">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-orange-600" /> Fechamento do dia</h3>
          <p className="text-xs text-slate-500">Resumo do caixa: vendas, formas de pagamento, taxa Zupi e diárias dos motoboys.</p>
        </div>
        <input type="date" data-testid="closing-date" value={date} max={new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border px-3 text-sm" />
        <button data-testid="closing-print" disabled={!d} onClick={() => printClosing(d)} className="h-11 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-40"><Printer className="w-4 h-4" /> Imprimir fechamento</button>
      </div>
      {d === null && <Loading />}
      {d === false && <p className="text-sm text-red-500">Não foi possível carregar o fechamento.</p>}
      {d && (
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1.5" data-testid="closing-sales">
            <p className="text-xs font-bold text-slate-400 uppercase">Vendas</p>
            <Row l={`Pedidos válidos (${d.cancelled} cancelados)`} v={d.orders} />
            <Row l="Produtos (bruto)" v={fmtBRL(d.gross)} />
            {d.discounts > 0 && <Row l="Descontos" v={`- ${fmtBRL(d.discounts)}`} />}
            <Row l="Taxas de entrega" v={fmtBRL(d.delivery_fees)} />
            <Row l="Total vendido" v={fmtBRL(d.total)} bold />
            <Row l="Ticket médio" v={fmtBRL(d.avg_ticket)} />
          </div>
          <div className="space-y-1.5" data-testid="closing-payments">
            <p className="text-xs font-bold text-slate-400 uppercase">Formas de pagamento</p>
            {d.by_payment.length === 0 && <p className="text-slate-400">Sem vendas neste dia</p>}
            {d.by_payment.map((p) => <Row key={p.method} l={`${PAY[p.method] || p.method} (${p.orders})`} v={fmtBRL(p.total)} />)}
          </div>
          <div className="space-y-1.5" data-testid="closing-costs">
            <p className="text-xs font-bold text-slate-400 uppercase">Custos e resultado</p>
            <Row l={`Taxa Zupi (${d.orders} × ${fmtBRL(d.platform_fee)})`} v={`- ${fmtBRL(d.zupi_fees)}`} />
            {d.couriers.map((c) => <Row key={c.name} l={`Diária ${c.name} (${c.deliveries} entr.)`} v={`- ${fmtBRL(c.daily_rate)}`} />)}
            <div className="pt-2 mt-2 border-t flex justify-between items-center">
              <span className="font-bold">Resultado do dia</span>
              <span className={`font-display font-extrabold text-xl ${d.net >= 0 ? "text-emerald-600" : "text-red-500"}`} data-testid="closing-net">{fmtBRL(d.net)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ l, v, bold }) => <div className={`flex justify-between gap-3 ${bold ? "font-bold text-slate-900" : "text-slate-600"}`}><span>{l}</span><span className="text-right">{v}</span></div>;

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
          <MerchantBilling />
          <DailyClosing />
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

          {data.logistics && (
            <div className="bg-white rounded-2xl border p-5" data-testid="finance-logistics-card">
              <h3 className="font-display font-bold text-slate-900 mb-1">Logística — motoboys da casa</h3>
              <p className="text-xs text-slate-500 mb-4">{data.logistics.couriers} motoboy(s) ativo(s) • diária total {fmtBRL(data.logistics.courier_daily)} • {data.logistics.deliveries} entregas no período</p>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Bike} label="Frete cobrado dos clientes" value={fmtBRL(data.logistics.delivery_fees)} testid="log-fees" />
                <StatCard icon={Wallet} label={`Custo diárias (${data.period_days} dias)`} value={fmtBRL(data.logistics.courier_cost)} testid="log-cost" />
                <StatCard icon={TrendingUp} label="Saldo da entrega" value={fmtBRL(data.logistics.balance)} sub={data.logistics.balance >= 0 ? "Frete cobre as diárias" : "Diárias acima do frete"} testid="log-balance" />
              </div>
            </div>
          )}

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
