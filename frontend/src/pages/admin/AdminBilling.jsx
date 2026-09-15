import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, apiError, fmtBRL } from "@/lib/api";
import { printInvoice } from "@/lib/printInvoice";
import { toast } from "sonner";
import { Receipt, CheckCircle2, RotateCcw, Printer, RefreshCw, Settings2 } from "lucide-react";

const PERIODS = [["weekly", "Semanal"], ["biweekly", "Quinzenal"], ["monthly", "Mensal"]];
const ST = { open: ["Em aberto", "bg-amber-100 text-amber-700"], overdue: ["Vencida", "bg-red-100 text-red-700"], paid: ["Paga", "bg-emerald-100 text-emerald-700"] };
const d = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");

export default function AdminBilling() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("faturas");
  const [cfg, setCfg] = useState(null);

  const load = () => api.get("/admin/billing").then((r) => { setData(r.data); setCfg({ billing_period: r.data.default_period, billing_due_days: r.data.due_days, billing_pix_key: r.data.pix_key, billing_pix_name: r.data.pix_name }); }).catch(() => setData(false));
  useEffect(() => { load(); }, []);

  const generate = async () => {
    const r = await api.post("/admin/billing/generate");
    toast.success(r.data.created ? `${r.data.created} fatura(s) gerada(s)` : "Nenhum período novo para faturar");
    load();
  };
  const pay = async (inv) => {
    const note = window.prompt(`Confirmar pagamento da fatura ${inv.number} (${fmtBRL(inv.amount)})?\nObservação (opcional):`, "Pix recebido");
    if (note === null) return;
    try { await api.post(`/admin/billing/${inv.id}/pay`, { payment_note: note }); toast.success("Fatura marcada como paga"); load(); } catch (e) { toast.error(apiError(e)); }
  };
  const reopen = async (inv) => { await api.post(`/admin/billing/${inv.id}/reopen`); toast.success("Fatura reaberta"); load(); };
  const setPeriod = async (rid, p) => { await api.put(`/admin/billing/restaurants/${rid}/period`, { billing_period: p }); toast.success("Periodicidade atualizada"); load(); };
  const saveCfg = async () => {
    try { await api.put("/admin/billing/settings", { ...cfg, billing_due_days: parseInt(cfg.billing_due_days, 10) || 5 }); toast.success("Configurações de cobrança salvas"); load(); } catch (e) { toast.error(apiError(e)); }
  };

  if (data === null) return <DashboardLayout menu={ADMIN_MENU} title="Faturas"><Loading /></DashboardLayout>;
  if (data === false) return <DashboardLayout menu={ADMIN_MENU} title="Faturas"><p className="text-sm text-red-500">Erro ao carregar faturas.</p></DashboardLayout>;

  const list = filter === "all" ? data.invoices : data.invoices.filter((i) => i.status === filter);

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Faturas dos lojistas" subtitle="Cobrança da taxa por pedido em períodos semanais, quinzenais ou mensais"
      actions={<button data-testid="billing-generate" onClick={generate} className="h-11 px-4 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Gerar faturas vencidas</button>}>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["open", "A receber (em aberto)"], ["overdue", "Vencidas"], ["paid", "Recebido"]].map(([s, l]) => (
          <button key={s} data-testid={`billing-total-${s}`} onClick={() => { setTab("faturas"); setFilter(filter === s ? "all" : s); }} className={`text-left bg-white rounded-2xl border p-4 ${filter === s ? "ring-2 ring-orange-400" : ""}`}>
            <p className="text-xs text-slate-500">{l} • {data.counts[s]} fatura(s)</p>
            <p className={`font-display font-extrabold text-2xl ${s === "overdue" ? "text-red-600" : s === "paid" ? "text-emerald-600" : "text-slate-900"}`}>{fmtBRL(data.totals[s])}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {[["faturas", Receipt, "Faturas"], ["periodos", RefreshCw, "Periodicidade por lojista"], ["config", Settings2, "Configuração"]].map(([id, Icon, l]) => (
          <button key={id} data-testid={`billing-tab-${id}`} onClick={() => setTab(id)} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === id ? "bg-slate-900 text-white" : "bg-white border text-slate-600"}`}><Icon className="w-4 h-4" /> {l}</button>
        ))}
      </div>

      {tab === "faturas" && (
        <div className="bg-white rounded-2xl border overflow-x-auto" data-testid="invoices-table">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="text-left text-xs text-slate-400 border-b"><th className="px-4 py-3">Fatura</th><th className="px-4 py-3">Lojista</th><th className="px-4 py-3">Período</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nenhuma fatura {filter !== "all" ? "neste status" : "gerada ainda — as faturas são geradas automaticamente quando um período fecha"}.</td></tr>}
              {list.map((i) => (
                <tr key={i.id} className="border-b last:border-0" data-testid={`invoice-row-${i.id}`}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{i.number}</td>
                  <td className="px-4 py-3 font-semibold">{i.restaurant_name}</td>
                  <td className="px-4 py-3 text-slate-600">{d(i.period_start)} – {d(new Date(new Date(i.period_end + "T12:00:00").getTime() - 86400000).toISOString().slice(0, 10))}</td>
                  <td className="px-4 py-3 text-slate-600">{d(i.due_date)}</td>
                  <td className="px-4 py-3 text-right">{i.orders}{i.cancelled ? <span className="text-xs text-slate-400"> (-{i.cancelled})</span> : ""}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">{fmtBRL(i.amount)}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ST[i.status][1]}`} data-testid={`invoice-status-${i.id}`}>{ST[i.status][0]}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button title="Imprimir / PDF" data-testid={`invoice-print-${i.id}`} onClick={async () => { const r = await api.get(`/admin/billing`); const inv = r.data.invoices.find((x) => x.id === i.id); printInvoice({ ...inv, pix_key: data.pix_key, pix_name: data.pix_name }); }} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><Printer className="w-4 h-4" /></button>
                      {i.status !== "paid"
                        ? <button data-testid={`invoice-pay-${i.id}`} onClick={() => pay(i)} className="h-9 px-3 rounded-lg bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Marcar paga</button>
                        : <button data-testid={`invoice-reopen-${i.id}`} onClick={() => reopen(i)} className="h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1 text-slate-600"><RotateCcw className="w-3.5 h-3.5" /> Reabrir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "periodos" && (
        <div className="bg-white rounded-2xl border overflow-x-auto" data-testid="periods-table">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-xs text-slate-400 border-b"><th className="px-4 py-3">Lojista</th><th className="px-4 py-3">Cidade</th><th className="px-4 py-3">Periodicidade da fatura</th></tr></thead>
            <tbody>
              {data.restaurants.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.city}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {PERIODS.map(([p, l]) => (
                        <button key={p} data-testid={`period-${p}-${r.id}`} onClick={() => r.billing_period !== p && setPeriod(r.id, p)} className={`h-9 px-3 rounded-lg text-xs font-bold ${r.billing_period === p ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "config" && cfg && (
        <div className="bg-white rounded-2xl border p-5 max-w-lg space-y-4" data-testid="billing-config">
          <div>
            <label className="text-sm font-semibold text-slate-700">Periodicidade padrão (novos lojistas)</label>
            <div className="flex gap-1.5 mt-1">
              {PERIODS.map(([p, l]) => <button key={p} data-testid={`cfg-period-${p}`} onClick={() => setCfg({ ...cfg, billing_period: p })} className={`h-10 px-4 rounded-lg text-xs font-bold ${cfg.billing_period === p ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>)}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Dias para vencimento após o fechamento</label>
            <Input data-testid="cfg-due-days" type="number" min="1" max="30" value={cfg.billing_due_days} onChange={(e) => setCfg({ ...cfg, billing_due_days: e.target.value })} className="mt-1 h-12 rounded-xl w-32" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Chave Pix da Zupi (aparece na fatura)</label>
            <Input data-testid="cfg-pix-key" value={cfg.billing_pix_key} onChange={(e) => setCfg({ ...cfg, billing_pix_key: e.target.value })} placeholder="CNPJ, e-mail, telefone ou chave aleatória" className="mt-1 h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Nome do favorecido</label>
            <Input data-testid="cfg-pix-name" value={cfg.billing_pix_name} onChange={(e) => setCfg({ ...cfg, billing_pix_name: e.target.value })} placeholder="Zupi Delivery LTDA" className="mt-1 h-12 rounded-xl" />
          </div>
          <Button data-testid="cfg-save" onClick={saveCfg} className="h-12 rounded-xl font-bold">Salvar configuração</Button>
        </div>
      )}
    </DashboardLayout>
  );
}
