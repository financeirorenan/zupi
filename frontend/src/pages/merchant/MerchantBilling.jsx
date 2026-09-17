import { useEffect, useState } from "react";
import { Receipt, Printer, Copy } from "lucide-react";
import { Loading } from "@/components/States";
import { api, fmtBRL } from "@/lib/api";
import { printInvoice } from "@/lib/printInvoice";
import { toast } from "sonner";

const ST = { open: ["Em aberto", "bg-amber-100 text-amber-700"], overdue: ["Vencida", "bg-red-100 text-red-700"], paid: ["Paga", "bg-emerald-100 text-emerald-700"] };
const d = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
const endInc = (iso) => d(new Date(new Date(iso + "T12:00:00").getTime() - 86400000).toISOString().slice(0, 10));

export default function MerchantBilling() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/merchant/billing").then((r) => setData(r.data)).catch(() => setData(false)); }, []);

  const print = async (inv) => { const r = await api.get(`/merchant/billing/${inv.id}`); printInvoice(r.data); };

  if (data === null) return <div className="bg-white rounded-2xl border p-5"><Loading /></div>;
  if (data === false) return null;
  const c = data.current;

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4" data-testid="merchant-billing">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[240px]">
          <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><Receipt className="w-5 h-5 text-orange-600" /> Fatura Zupi — período atual ({c.period_label.toLowerCase()})</h3>
          <p className="text-xs text-slate-500">{d(c.period_start)} a {endInc(c.period_end)} • fecha em {c.closes_in_days} dia(s) • vencimento {d(c.due_date)}</p>
          <p className="text-sm text-slate-600 mt-2">Você paga apenas <b>{fmtBRL(c.platform_fee)} por pedido</b> feito pela Zupi. Pix, cartão e dinheiro dos clientes vão direto para você.</p>
        </div>
        <div className="text-right bg-orange-50 rounded-2xl px-5 py-3" data-testid="billing-current">
          <p className="text-xs font-semibold text-orange-700">Acumulado no período</p>
          <p className="font-display font-extrabold text-3xl text-orange-600">{fmtBRL(c.amount)}</p>
          <p className="text-xs text-slate-500">{c.orders} pedidos{c.cancelled ? ` • ${c.cancelled} cancelados (estornados)` : ""}</p>
        </div>
      </div>

      {data.billing_blocked && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4" data-testid="billing-blocked-alert">
          <p className="font-display font-extrabold text-red-700">Loja pausada por fatura em atraso</p>
          <p className="text-sm text-red-700/80 mt-1">Há fatura Zupi vencida há mais de {data.block_days} dias. Assim que o pagamento for confirmado pela Zupi, sua loja volta a receber pedidos automaticamente.</p>
        </div>
      )}

      {data.open_total > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-3" data-testid="billing-open-alert">
          <p className="text-sm font-semibold text-amber-800 flex-1">Você tem {fmtBRL(data.open_total)} em fatura(s) a pagar.</p>
          {data.pix_key && (
            <button data-testid="billing-copy-pix" onClick={() => navigator.clipboard?.writeText(data.pix_key).then(() => toast.success("Chave Pix copiada"))} className="h-9 px-3 rounded-lg bg-white border text-xs font-bold flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Copiar Pix da Zupi</button>
          )}
        </div>
      )}

      {data.invoices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]" data-testid="merchant-invoices">
            <thead><tr className="text-left text-xs text-slate-400 border-b"><th className="py-2 pr-3">Fatura</th><th className="py-2 pr-3">Período</th><th className="py-2 pr-3">Vencimento</th><th className="py-2 pr-3 text-right">Pedidos</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2 pr-3">Status</th><th /></tr></thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={i.id} className="border-b last:border-0" data-testid={`merchant-invoice-${i.id}`}>
                  <td className="py-2.5 pr-3 font-mono text-xs font-bold">{i.number}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{d(i.period_start)} – {endInc(i.period_end)}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{d(i.due_date)}</td>
                  <td className="py-2.5 pr-3 text-right">{i.orders}</td>
                  <td className="py-2.5 pr-3 text-right font-bold text-orange-600">{fmtBRL(i.amount)}</td>
                  <td className="py-2.5 pr-3"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${ST[i.status][1]}`}>{ST[i.status][0]}</span></td>
                  <td className="py-2.5 text-right"><button data-testid={`merchant-invoice-print-${i.id}`} onClick={() => print(i)} className="w-9 h-9 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500"><Printer className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
