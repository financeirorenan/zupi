import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import StatusBadge from "@/components/StatusBadge";
import { Loading } from "@/components/States";
import { api, apiError, fmtBRL, fmtDateTime } from "@/lib/api";
import { toast } from "sonner";
import { Zap, ClipboardList, Wallet } from "lucide-react";

const NEXT = { PENDING: "ACCEPTED", ACCEPTED: "PREPARING", PREPARING: "READY", READY: "OUT_FOR_DELIVERY", OUT_FOR_DELIVERY: "DELIVERED" };
const NEXT_LABEL = { PENDING: "Aceitar", ACCEPTED: "Preparar", PREPARING: "Pronto", READY: "Saiu p/ entrega", OUT_FOR_DELIVERY: "Entregue" };

export default function AdminFinance() {
  const [tab, setTab] = useState("financeiro");
  const [finance, setFinance] = useState(null);
  const [orders, setOrders] = useState(null);

  const loadFinance = () => api.get("/admin/finance").then((r) => setFinance(r.data));
  const loadOrders = () => api.get("/admin/orders").then((r) => setOrders(r.data));
  useEffect(() => { loadFinance(); loadOrders(); }, []);

  const act = async (o, status) => {
    try {
      await api.post(`/admin/orders/${o.id}/status`, { status });
      toast.success(`Pedido ${o.code} atualizado`);
      loadOrders();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Financeiro e pedidos" subtitle="Receita Zupi e operação de pedidos">
      <div className="flex gap-2 mb-4">
        <button data-testid="tab-financeiro" onClick={() => setTab("financeiro")} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === "financeiro" ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}><Wallet className="w-4 h-4" /> Financeiro</button>
        <button data-testid="tab-pedidos" onClick={() => setTab("pedidos")} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === "pedidos" ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}><ClipboardList className="w-4 h-4" /> Pedidos</button>
      </div>

      {tab === "financeiro" && (
        !finance ? <Loading /> : (
          <div className="space-y-5">
            <div className="bg-[#121212] rounded-2xl p-6 text-white flex flex-wrap items-center gap-6" data-testid="admin-finance-hero">
              <Zap className="w-10 h-10 text-orange-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Receita Zupi acumulada</p>
                <p className="font-display font-extrabold text-3xl text-orange-400">{fmtBRL(finance.zupi_revenue)}</p>
              </div>
              <p className="text-sm text-slate-400">Modelo: R$ 2,00 por pedido (configurável em Sistema)</p>
            </div>

            <div className="bg-white rounded-2xl border overflow-x-auto">
              <h3 className="font-display font-bold text-slate-900 p-5 pb-2">Receita por restaurante</h3>
              <table className="w-full text-sm min-w-[480px]" data-testid="revenue-by-restaurant">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b"><th className="px-5 py-2">Restaurante</th><th className="px-5 py-2">Pedidos tarifados</th><th className="px-5 py-2 text-right">Taxas Zupi</th></tr>
                </thead>
                <tbody>
                  {finance.by_restaurant.map((r) => (
                    <tr key={r.restaurant_id} className="border-b last:border-0">
                      <td className="px-5 py-2.5 font-semibold">{r.restaurant}</td>
                      <td className="px-5 py-2.5">{r.count}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-orange-600">{fmtBRL(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border overflow-x-auto">
              <h3 className="font-display font-bold text-slate-900 p-5 pb-2">Últimas transações</h3>
              <table className="w-full text-sm min-w-[480px]" data-testid="admin-transactions">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b"><th className="px-5 py-2">Data</th><th className="px-5 py-2">Descrição</th><th className="px-5 py-2 text-right">Valor</th></tr>
                </thead>
                <tbody>
                  {finance.transactions.slice(0, 30).map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5 text-slate-500">{fmtDateTime(t.created_at)}</td>
                      <td className="px-5 py-2.5">{t.description}</td>
                      <td className={`px-5 py-2.5 text-right font-bold ${t.amount < 0 ? "text-red-500" : "text-emerald-600"}`}>{fmtBRL(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === "pedidos" && (
        !orders ? <Loading /> : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]" data-testid="admin-orders-table">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b">
                  <th className="p-4">Pedido</th><th className="p-4">Restaurante</th><th className="p-4">Cliente</th><th className="p-4">Cidade</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0" data-testid={`admin-order-${o.code.replace("#", "")}`}>
                    <td className="p-4 font-bold">{o.code}<p className="text-[10px] text-slate-400 font-normal">{fmtDateTime(o.created_at)}</p></td>
                    <td className="p-4">{o.restaurant_name}</td>
                    <td className="p-4">{o.customer_name}</td>
                    <td className="p-4">{o.city}</td>
                    <td className="p-4 font-bold text-orange-600">{fmtBRL(o.total)}</td>
                    <td className="p-4"><StatusBadge status={o.status} /></td>
                    <td className="p-4">
                      <div className="flex gap-1.5 justify-end">
                        {NEXT[o.status] && (
                          <button data-testid={`admin-advance-${o.code.replace("#", "")}`} onClick={() => act(o, NEXT[o.status])} className="h-9 px-3 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700">
                            {NEXT_LABEL[o.status]}
                          </button>
                        )}
                        {["PENDING", "ACCEPTED"].includes(o.status) && (
                          <button data-testid={`admin-cancel-${o.code.replace("#", "")}`} onClick={() => act(o, "CANCELLED")} className="h-9 px-3 rounded-lg bg-red-100 text-red-600 text-xs font-bold">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </DashboardLayout>
  );
}
