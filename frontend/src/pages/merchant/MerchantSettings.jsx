import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { PauseCircle, PlayCircle } from "lucide-react";

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const EMPTY = { name: "", description: "", category: "Outros", phone: "", logo: "", cover: "", city: "", state: "SP", address: { street: "", number: "", district: "", cep: "" }, delivery_fee: "", min_order: "", prep_time: 40, payment_methods: ["pix", "cash", "card_machine"], delivery_zones: [], hours: {} };

export default function MerchantSettings() {
  const [rest, setRest] = useState(undefined); // undefined=loading, null=não cadastrado
  const [form, setForm] = useState(null);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/cities").then((r) => setCities(r.data)).catch(() => {});
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    api.get("/merchant/restaurant").then((r) => {
      setRest(r.data);
      setForm({ ...r.data, delivery_fee: String(r.data.delivery_fee), min_order: String(r.data.min_order) });
    }).catch((e) => {
      if (e?.response?.status === 404) { setRest(null); setForm(EMPTY); }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = { ...form, delivery_fee: parseFloat(form.delivery_fee) || 0, min_order: parseFloat(form.min_order) || 0, prep_time: parseInt(form.prep_time) || 40 };
    try {
      if (rest) {
        await api.put("/merchant/restaurant", payload);
        toast.success("Configurações salvas");
      } else {
        await api.post("/merchant/restaurant", payload);
        toast.success("Cadastro enviado! O time Zupi vai aprovar seu restaurante em breve.");
      }
      window.location.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async (paused) => {
    await api.post("/merchant/pause", { paused });
    setRest({ ...rest, paused });
    toast.success(paused ? "Pedidos pausados" : "Pedidos reativados");
  };

  const setWindow = (day, idx, key, value) => {
    const hours = { ...form.hours };
    const windows = [...(hours[day] || [])];
    windows[idx] = { ...windows[idx], [key]: value };
    hours[day] = windows;
    setForm({ ...form, hours });
  };

  if (!form) return <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Configurações"><Loading /></DashboardLayout>;

  return (
    <DashboardLayout variant="top"
      menu={MERCHANT_MENU}
      title={rest ? "Configurações" : "Cadastro do restaurante"}
      subtitle={rest ? `${rest.name} • ${rest.status === "active" ? "Ativo" : rest.status === "pending" ? "Aguardando aprovação" : "Bloqueado"}` : "Preencha os dados para começar a vender"}
      actions={rest && (
        <button
          data-testid="pause-orders-toggle"
          onClick={() => togglePause(!rest.paused)}
          className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 ${rest.paused ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"}`}
        >
          {rest.paused ? <><PlayCircle className="w-4 h-4" /> Reativar pedidos</> : <><PauseCircle className="w-4 h-4" /> Pausar pedidos</>}
        </button>
      )}
    >
      <div className="max-w-2xl space-y-5">
        {rest?.status === "pending" && (
          <p className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3" data-testid="pending-approval-banner">
            Seu restaurante está em análise pelo time Zupi. Você já pode montar o cardápio.
          </p>
        )}

        <section className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-900">Dados do restaurante</h3>
          <Input data-testid="rest-name" placeholder="Nome do restaurante *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
          <Input data-testid="rest-desc" placeholder="Descrição curta" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-12 rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <select data-testid="rest-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white">
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select data-testid="rest-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white">
              <option value="">Cidade *</option>
              {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <Input data-testid="rest-phone" placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" />
            <Input data-testid="rest-prep" type="number" min="5" placeholder="Tempo de preparo (min)" value={form.prep_time} onChange={(e) => setForm({ ...form, prep_time: e.target.value })} className="h-12 rounded-xl" />
            <Input data-testid="rest-delivery-fee" type="number" step="0.5" min="0" placeholder="Taxa de entrega padrão R$" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} className="h-12 rounded-xl" />
            <Input data-testid="rest-min-order" type="number" step="0.5" min="0" placeholder="Pedido mínimo R$" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="h-12 rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><ImageUpload testid="rest-cover-upload" label="Foto de capa" value={form.cover} onChange={(url) => setForm({ ...form, cover: url })} /></div>
            <ImageUpload testid="rest-logo-upload" label="Logo" aspect="aspect-square" value={form.logo} onChange={(url) => setForm({ ...form, logo: url })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input data-testid="rest-street" placeholder="Rua" value={form.address?.street || ""} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} className="h-12 rounded-xl" />
            <Input data-testid="rest-number" placeholder="Número" value={form.address?.number || ""} onChange={(e) => setForm({ ...form, address: { ...form.address, number: e.target.value } })} className="h-12 rounded-xl" />
            <Input data-testid="rest-district" placeholder="Bairro" value={form.address?.district || ""} onChange={(e) => setForm({ ...form, address: { ...form.address, district: e.target.value } })} className="h-12 rounded-xl" />
            <Input data-testid="rest-cep" placeholder="CEP" value={form.address?.cep || ""} onChange={(e) => setForm({ ...form, address: { ...form.address, cep: e.target.value } })} className="h-12 rounded-xl" />
          </div>
        </section>

        <section className="bg-white rounded-2xl border p-5">
          <h3 className="font-display font-bold text-slate-900">Área de entrega e motoboys</h3>
          <p className="text-sm text-slate-500 mt-1">A taxa por bairro e o cadastro de motoboys ficam no menu <Link to="/lojista/logistica" data-testid="go-logistics-link" className="text-orange-600 font-bold">Logística</Link>.</p>
        </section>

        <section className="bg-white rounded-2xl border p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-900">Horários de funcionamento</h3>
          {DAYS.map((label, day) => {
            const windows = form.hours?.[String(day)] || [];
            return (
              <div key={day} className="flex items-center gap-3 flex-wrap" data-testid={`hours-day-${day}`}>
                <span className="w-20 text-sm font-semibold text-slate-700">{label}</span>
                <Switch checked={windows.length > 0} onCheckedChange={(on) => setForm({ ...form, hours: { ...form.hours, [String(day)]: on ? [{ open: "11:00", close: "14:00" }, { open: "18:00", close: "23:00" }] : [] } })} data-testid={`hours-toggle-${day}`} />
                {windows.length === 0 && <span className="text-xs text-slate-400">Fechado</span>}
                {windows.map((w, i) => (
                  <span key={i} className="flex items-center gap-1 text-sm">
                    <input type="time" value={w.open} onChange={(e) => setWindow(String(day), i, "open", e.target.value)} className="h-10 rounded-lg border px-2 text-sm" data-testid={`hours-open-${day}-${i}`} />
                    <span className="text-slate-400">às</span>
                    <input type="time" value={w.close} onChange={(e) => setWindow(String(day), i, "close", e.target.value)} className="h-10 rounded-lg border px-2 text-sm" data-testid={`hours-close-${day}-${i}`} />
                  </span>
                ))}
              </div>
            );
          })}
        </section>

        <Button data-testid="settings-save-button" onClick={save} disabled={saving || !form.name || !form.city} className="w-full h-14 rounded-2xl font-bold text-base">
          {saving ? "Salvando..." : rest ? "Salvar configurações" : "Enviar para aprovação"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
