import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError, fmtBRL } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Bike, MapPin, Search } from "lucide-react";

const EMPTY_COURIER = { name: "", phone: "", vehicle: "moto", daily_rate: "", active: true };

function DistrictSearch({ city, exclude, onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/cities/${encodeURIComponent(city)}/districts`, { params: { q } })
        .then((r) => setResults(r.data.filter((n) => !exclude.includes(n.toLowerCase()))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, city, exclude]);

  const addManual = async () => {
    const name = q.trim();
    if (!name) return;
    try { await api.post("/merchant/logistics/districts", { name }); } catch {}
    onPick(name);
    setQ("");
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input data-testid="district-search-input" placeholder={`Buscar bairro em ${city}...`} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-xl pl-9" />
      </div>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto" data-testid="district-results">
        {loading && <span className="text-xs text-slate-400">Buscando bairros...</span>}
        {!loading && results.map((n) => (
          <button key={n} data-testid={`district-option-${n.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => onPick(n)} className="h-9 px-3 rounded-full bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-xs font-semibold">
            + {n}
          </button>
        ))}
        {!loading && results.length === 0 && q.trim() && (
          <button data-testid="district-add-manual" onClick={addManual} className="h-9 px-3 rounded-full bg-orange-600 text-white text-xs font-bold">
            Adicionar bairro "{q.trim()}"
          </button>
        )}
        {!loading && results.length === 0 && !q.trim() && <span className="text-xs text-slate-400">Nenhum bairro encontrado. Digite o nome para adicionar.</span>}
      </div>
    </div>
  );
}

export default function MerchantLogistics() {
  const [rest, setRest] = useState(null);
  const [zones, setZones] = useState([]);
  const [defaultFee, setDefaultFee] = useState("");
  const [couriers, setCouriers] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadCouriers = () => api.get("/merchant/logistics/couriers").then((r) => setCouriers(r.data)).catch(() => setCouriers([]));

  useEffect(() => {
    api.get("/merchant/restaurant").then((r) => {
      setRest(r.data);
      setZones(r.data.delivery_zones || []);
      setDefaultFee(String(r.data.delivery_fee ?? 0));
    }).catch(() => setRest(false));
    loadCouriers();
  }, []);

  const saveZones = async () => {
    setSaving(true);
    try {
      await api.put("/merchant/logistics/zones", { delivery_fee: parseFloat(defaultFee) || 0, delivery_zones: zones.map((z) => ({ ...z, fee: parseFloat(z.fee) || 0 })) });
      toast.success("Taxas de entrega salvas");
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const saveCourier = async () => {
    const payload = { ...form, daily_rate: parseFloat(form.daily_rate) || 0 };
    try {
      if (form.id) await api.put(`/merchant/logistics/couriers/${form.id}`, payload);
      else await api.post("/merchant/logistics/couriers", payload);
      setForm(null); loadCouriers(); toast.success("Entregador salvo");
    } catch (e) { toast.error(apiError(e)); }
  };

  const removeCourier = async (c) => {
    if (!window.confirm(`Remover ${c.name}?`)) return;
    await api.delete(`/merchant/logistics/couriers/${c.id}`);
    loadCouriers(); toast.success("Entregador removido");
  };

  const toggleCourier = async (c) => {
    await api.put(`/merchant/logistics/couriers/${c.id}`, { ...c, active: !c.active });
    loadCouriers();
  };

  if (rest === null || couriers === null) return <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Logística"><Loading /></DashboardLayout>;
  if (rest === false) return <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Logística"><p className="text-sm text-slate-500">Cadastre seu restaurante em Configurações antes de configurar a logística.</p></DashboardLayout>;

  const dailyTotal = couriers.filter((c) => c.active).reduce((s, c) => s + (c.daily_rate || 0), 0);
  const excluded = zones.map((z) => z.district.toLowerCase());

  return (
    <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Logística" subtitle="Motoboys da casa e taxa de entrega por bairro">
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-2xl border p-5 space-y-4" data-testid="couriers-section">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><Bike className="w-5 h-5 text-orange-600" /> Motoboys da casa</h3>
              <p className="text-xs text-slate-500">Diária total ativa: <b data-testid="courier-daily-total">{fmtBRL(dailyTotal)}</b>/dia</p>
            </div>
            <Button data-testid="add-courier-button" onClick={() => setForm(EMPTY_COURIER)} className="h-11 rounded-xl font-bold"><Plus className="w-4 h-4 mr-1" /> Motoboy</Button>
          </div>
          {couriers.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Nenhum motoboy cadastrado ainda.</p>}
          <div className="space-y-2">
            {couriers.map((c) => (
              <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 ${c.active ? "" : "opacity-60"}`} data-testid={`courier-row-${c.id}`}>
                <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-display font-extrabold">{c.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.phone || "sem telefone"} • {c.vehicle === "moto" ? "Moto" : c.vehicle === "bike" ? "Bicicleta" : "Carro"} • Diária {fmtBRL(c.daily_rate)}</p>
                </div>
                <Switch checked={c.active} onCheckedChange={() => toggleCourier(c)} data-testid={`courier-toggle-${c.id}`} />
                <button onClick={() => setForm({ ...c, daily_rate: String(c.daily_rate) })} className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500" data-testid={`courier-edit-${c.id}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => removeCourier(c)} className="w-10 h-10 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500" data-testid={`courier-delete-${c.id}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border p-5 space-y-4" data-testid="zones-section">
          <div>
            <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><MapPin className="w-5 h-5 text-orange-600" /> Taxa de entrega por bairro</h3>
            <p className="text-xs text-slate-500">Cidade: <b>{rest.city}</b>. Bairros sem taxa definida pagam a taxa padrão.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700 flex-1">Taxa padrão (R$)</label>
            <Input data-testid="default-fee-input" type="number" step="0.5" min="0" value={defaultFee} onChange={(e) => setDefaultFee(e.target.value)} className="h-11 rounded-xl w-32" />
          </div>
          <DistrictSearch city={rest.city} exclude={excluded} onPick={(name) => setZones([...zones, { district: name, fee: defaultFee }])} />
          <div className="space-y-2" data-testid="zones-list">
            {zones.length === 0 && <p className="text-xs text-slate-400">Nenhum bairro com taxa específica.</p>}
            {zones.map((z, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border p-2 pl-3" data-testid={`zone-row-${i}`}>
                <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{z.district}</span>
                <span className="text-xs text-slate-400">R$</span>
                <Input type="number" step="0.5" min="0" value={z.fee} onChange={(e) => { const dz = [...zones]; dz[i] = { ...z, fee: e.target.value }; setZones(dz); }} className="h-10 rounded-lg w-24" data-testid={`zone-fee-${i}`} />
                <button onClick={() => setZones(zones.filter((_, x) => x !== i))} className="w-10 h-10 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500" data-testid={`zone-remove-${i}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <Button data-testid="zones-save-button" onClick={saveZones} disabled={saving} className="w-full h-12 rounded-xl font-bold">{saving ? "Salvando..." : "Salvar taxas de entrega"}</Button>
        </section>
      </div>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="max-w-md rounded-2xl" data-testid="courier-form-modal">
          <DialogHeader><DialogTitle className="font-display">{form?.id ? "Editar motoboy" : "Novo motoboy"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <Input data-testid="courier-name-input" placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
              <Input data-testid="courier-phone-input" placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <select data-testid="courier-vehicle-select" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white">
                  <option value="moto">Moto</option><option value="bike">Bicicleta</option><option value="car">Carro</option>
                </select>
                <Input data-testid="courier-daily-input" type="number" step="1" min="0" placeholder="Valor da diária R$" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-semibold text-slate-700">Ativo</span>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="courier-active-switch" />
              </div>
              <Button data-testid="courier-save-button" onClick={saveCourier} disabled={!form.name?.trim()} className="w-full h-12 rounded-xl font-bold">Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
