import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import Stars from "@/components/Stars";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError, fmtBRL } from "@/lib/api";
import { toast } from "sonner";
import { Plus, CheckCircle, Ban, Sparkles } from "lucide-react";

const EMPTY = { name: "", owner_email: "", owner_password: "", owner_name: "", category: "Outros", city: "", phone: "", delivery_fee: "", min_order: "", prep_time: 40 };
const STATUS_LABEL = { active: "Ativo", pending: "Pendente", blocked: "Bloqueado" };
const STATUS_CLS = { active: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700", blocked: "bg-red-100 text-red-700" };

export default function AdminRestaurants() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(null);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);

  const load = () => api.get("/admin/restaurants", { params: filter ? { status: filter } : {} }).then((r) => setItems(r.data));
  useEffect(() => { setItems(null); load().catch(() => setItems([])); }, [filter]);
  useEffect(() => {
    api.get("/cities").then((r) => setCities(r.data)).catch(() => {});
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); load(); } catch (e) { toast.error(apiError(e)); }
  };

  const save = async () => {
    try {
      await api.post("/admin/restaurants", { ...form, delivery_fee: parseFloat(form.delivery_fee) || 0, min_order: parseFloat(form.min_order) || 0, prep_time: parseInt(form.prep_time) || 40 });
      setForm(null); load(); toast.success("Restaurante cadastrado e ativo");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <DashboardLayout
      menu={ADMIN_MENU}
      title="Restaurantes"
      subtitle="Aprovação, bloqueio e destaques"
      actions={<Button data-testid="admin-add-restaurant" onClick={() => setForm(EMPTY)} className="h-10 rounded-xl font-bold text-sm"><Plus className="w-4 h-4 mr-1" /> Restaurante</Button>}
    >
      <div className="flex gap-2 mb-4">
        {["", "active", "pending", "blocked"].map((s) => (
          <button key={s} data-testid={`rest-filter-${s || "all"}`} onClick={() => setFilter(s)} className={`h-9 px-4 rounded-full text-xs font-bold border ${filter === s ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600"}`}>
            {s === "" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {!items ? <Loading /> : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]" data-testid="restaurants-table">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b">
                <th className="p-4">Restaurante</th><th className="p-4">Cidade</th><th className="p-4">Pedidos</th><th className="p-4">Avaliação</th><th className="p-4">Taxa</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b last:border-0" data-testid={`restaurant-row-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <td className="p-4">
                    <p className="font-bold text-slate-800 flex items-center gap-2">{r.name} {r.featured && <Sparkles className="w-3.5 h-3.5 text-orange-500" />}</p>
                    <p className="text-xs text-slate-400">{r.category}</p>
                  </td>
                  <td className="p-4">{r.city}</td>
                  <td className="p-4">{r.order_count}</td>
                  <td className="p-4"><Stars rating={r.rating} /></td>
                  <td className="p-4">{fmtBRL(r.delivery_fee)}</td>
                  <td className="p-4"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td className="p-4">
                    <div className="flex gap-1.5 justify-end">
                      {r.status === "pending" && (
                        <Button size="sm" data-testid={`approve-${r.id.slice(0, 8)}`} onClick={() => act(() => api.post(`/admin/restaurants/${r.id}/approve`), "Restaurante aprovado")} className="rounded-lg h-9 text-xs font-bold bg-emerald-500 hover:bg-emerald-600">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" data-testid={`feature-${r.id.slice(0, 8)}`} onClick={() => act(() => api.put(`/admin/restaurants/${r.id}`, { featured: !r.featured }), r.featured ? "Destaque removido" : "Destacado na home")} className="rounded-lg h-9 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                      </Button>
                      {r.status !== "pending" && (
                        <Button size="sm" variant="outline" data-testid={`block-${r.id.slice(0, 8)}`} onClick={() => act(() => api.post(`/admin/restaurants/${r.id}/block`), r.status === "blocked" ? "Desbloqueado" : "Bloqueado")} className={`rounded-lg h-9 text-xs font-bold ${r.status === "blocked" ? "" : "text-red-600 border-red-200"}`}>
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-md rounded-2xl" data-testid="admin-restaurant-form">
          <DialogHeader><DialogTitle className="font-display">Cadastrar restaurante</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <Input data-testid="ar-name" placeholder="Nome do restaurante *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <Input data-testid="ar-owner-name" placeholder="Nome do dono" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="ar-phone" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <Input data-testid="ar-owner-email" type="email" placeholder="E-mail do dono *" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} className="h-12 rounded-xl" />
              <Input data-testid="ar-owner-password" placeholder="Senha inicial do dono *" value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} className="h-12 rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <select data-testid="ar-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white">
                  <option value="">Cidade *</option>
                  {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <select data-testid="ar-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white">
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <Input data-testid="ar-delivery-fee" type="number" step="0.5" min="0" placeholder="Taxa entrega R$" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="ar-min-order" type="number" step="0.5" min="0" placeholder="Pedido mínimo R$" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <Button data-testid="ar-save" onClick={save} disabled={!form.name || !form.city || !form.owner_email || form.owner_password.length < 6} className="w-full h-12 rounded-xl font-bold">Cadastrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
