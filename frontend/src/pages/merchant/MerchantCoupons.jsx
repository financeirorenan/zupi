import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, fmtBRL, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ticket } from "lucide-react";

const EMPTY = { code: "", type: "percent", value: "", min_order: "", max_uses: "", valid_until: "", first_purchase: false, active: true };

export default function MerchantCoupons() {
  const [coupons, setCoupons] = useState(null);
  const [form, setForm] = useState(null);

  const load = () => api.get("/merchant/coupons").then((r) => setCoupons(r.data)).catch(() => setCoupons([]));
  useEffect(load, []);

  const save = async () => {
    const payload = {
      ...form,
      value: parseFloat(form.value) || 0,
      min_order: parseFloat(form.min_order) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
    };
    try {
      if (form.id) await api.put(`/merchant/coupons/${form.id}`, payload);
      else await api.post("/merchant/coupons", payload);
      setForm(null); load(); toast.success("Cupom salvo");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <DashboardLayout
      menu={MERCHANT_MENU}
      title="Cupons"
      subtitle="Crie cupons para atrair clientes do seu bairro"
      actions={<Button data-testid="add-coupon-button" onClick={() => setForm(EMPTY)} className="h-10 rounded-xl font-bold text-sm"><Plus className="w-4 h-4 mr-1" /> Cupom</Button>}
    >
      {!coupons ? <Loading /> : coupons.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center" data-testid="coupons-empty">
          <Ticket className="w-10 h-10 text-orange-300 mx-auto" />
          <p className="text-sm text-slate-400 mt-3">Nenhum cupom criado. Ex: PRIMEIRA10 com 10% off.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]" data-testid="coupons-table">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b">
                <th className="p-4">Código</th><th className="p-4">Desconto</th><th className="p-4">Mínimo</th><th className="p-4">Usos</th><th className="p-4">Status</th><th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b last:border-0" data-testid={`coupon-row-${c.code}`}>
                  <td className="p-4 font-bold text-slate-800">{c.code}{c.first_purchase && <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">1ª compra</span>}</td>
                  <td className="p-4">{c.type === "percent" ? `${c.value}%` : fmtBRL(c.value)}</td>
                  <td className="p-4">{c.min_order > 0 ? fmtBRL(c.min_order) : "—"}</td>
                  <td className="p-4">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                  <td className="p-4">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.active ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => setForm({ ...c, value: String(c.value), min_order: String(c.min_order), max_uses: c.max_uses ? String(c.max_uses) : "", valid_until: c.valid_until?.slice(0, 10) || "" })} className="text-slate-400 hover:text-orange-600 mr-2" data-testid="edit-coupon"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => window.confirm(`Excluir cupom ${c.code}?`) && api.delete(`/merchant/coupons/${c.id}`).then(load)} className="text-slate-400 hover:text-red-500" data-testid="delete-coupon"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-sm rounded-2xl" data-testid="coupon-form-modal">
          <DialogHeader><DialogTitle className="font-display">{form?.id ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <Input data-testid="coupon-code-input" placeholder="Código (ex: TERRA15)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="h-12 rounded-xl uppercase" />
              <div className="grid grid-cols-2 gap-2">
                <select data-testid="coupon-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white">
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
                <Input data-testid="coupon-value" type="number" min="0" step="0.01" placeholder="Valor" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="coupon-min-order" type="number" min="0" step="0.01" placeholder="Pedido mínimo" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="coupon-max-uses" type="number" min="0" placeholder="Limite de usos" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Válido até</label>
                <Input data-testid="coupon-valid-until" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="h-12 rounded-xl mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.first_purchase} onChange={(e) => setForm({ ...form, first_purchase: e.target.checked })} data-testid="coupon-first-purchase" /> Só primeira compra
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="coupon-active" /> Ativo
              </label>
              <Button data-testid="coupon-save-button" onClick={save} disabled={!form.code?.trim() || !form.value} className="w-full h-12 rounded-xl font-bold">Salvar cupom</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
