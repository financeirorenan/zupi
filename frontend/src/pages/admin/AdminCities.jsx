import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Tag } from "lucide-react";

export default function AdminCities() {
  const [tab, setTab] = useState("cidades");
  const [cities, setCities] = useState(null);
  const [categories, setCategories] = useState(null);
  const [cityForm, setCityForm] = useState({ name: "", state: "SP" });
  const [catForm, setCatForm] = useState({ name: "", image: "" });

  const loadCities = () => api.get("/admin/cities").then((r) => setCities(r.data));
  const loadCats = () => api.get("/admin/categories").then((r) => setCategories(r.data));
  useEffect(() => { loadCities(); loadCats(); }, []);

  const addCity = async () => {
    try { await api.post("/admin/cities", cityForm); setCityForm({ name: "", state: "SP" }); loadCities(); toast.success("Cidade cadastrada"); }
    catch (e) { toast.error(apiError(e)); }
  };

  const addCategory = async () => {
    try { await api.post("/admin/categories", { ...catForm, order: categories.length }); setCatForm({ name: "", image: "" }); loadCats(); toast.success("Categoria cadastrada"); }
    catch (e) { toast.error(apiError(e)); }
  };

  const toggleCity = async (c) => {
    await api.put(`/admin/cities/${c.id}`, { name: c.name, state: c.state, active: !c.active });
    loadCities();
  };

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Cidades e categorias" subtitle="Expansão multi-cidade da operação">
      <div className="flex gap-2 mb-4">
        <button data-testid="tab-cidades" onClick={() => setTab("cidades")} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === "cidades" ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}><MapPin className="w-4 h-4" /> Cidades</button>
        <button data-testid="tab-categorias" onClick={() => setTab("categorias")} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === "categorias" ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}><Tag className="w-4 h-4" /> Categorias</button>
      </div>

      {tab === "cidades" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white rounded-2xl border p-4 flex gap-2">
            <Input data-testid="city-name-input" placeholder="Nome da cidade" value={cityForm.name} onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })} className="h-12 rounded-xl flex-1" />
            <Input data-testid="city-state-input" placeholder="UF" value={cityForm.state} onChange={(e) => setCityForm({ ...cityForm, state: e.target.value.toUpperCase() })} className="h-12 rounded-xl w-20" maxLength={2} />
            <Button data-testid="add-city-button" onClick={addCity} disabled={cityForm.name.length < 2} className="h-12 rounded-xl font-bold"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
          </div>
          {!cities ? <Loading /> : (
            <div className="bg-white rounded-2xl border divide-y" data-testid="cities-list">
              {cities.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-4" data-testid={`city-row-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800">{c.name} — {c.state}</p>
                    <p className="text-xs text-slate-400">{c.restaurants || 0} restaurantes</p>
                  </div>
                  <button data-testid={`toggle-city-${c.id.slice(0, 8)}`} onClick={() => toggleCity(c)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Ativa" : "Inativa"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "categorias" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white rounded-2xl border p-4 flex gap-2">
            <Input data-testid="category-name-input" placeholder="Nome da categoria" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="h-12 rounded-xl flex-1" />
            <Input data-testid="category-image-input" placeholder="URL da imagem" value={catForm.image} onChange={(e) => setCatForm({ ...catForm, image: e.target.value })} className="h-12 rounded-xl flex-1" />
            <Button data-testid="add-category-button" onClick={addCategory} disabled={catForm.name.length < 2} className="h-12 rounded-xl font-bold"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
          </div>
          {!categories ? <Loading /> : (
            <div className="grid sm:grid-cols-2 gap-3" data-testid="categories-list">
              {categories.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 overflow-hidden shrink-0">
                    {c.image && <img src={c.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <p className="flex-1 font-bold text-sm text-slate-800">{c.name}</p>
                  <button data-testid={`delete-category-${c.id.slice(0, 8)}`} onClick={() => window.confirm(`Excluir "${c.name}"?`) && api.delete(`/admin/categories/${c.id}`).then(loadCats)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
