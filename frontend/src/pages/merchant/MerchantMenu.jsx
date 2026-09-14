import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ImageUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, fmtBRL, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Power } from "lucide-react";

const EMPTY_PRODUCT = { category_id: "", name: "", description: "", price: "", promo_price: "", image: "", available: true, addons: [] };

export default function MerchantMenu() {
  const [cats, setCats] = useState(null);
  const [products, setProducts] = useState([]);
  const [catForm, setCatForm] = useState(null);
  const [prodForm, setProdForm] = useState(null);

  const load = () => {
    Promise.all([api.get("/merchant/menu/categories"), api.get("/merchant/menu/products")])
      .then(([c, p]) => { setCats(c.data); setProducts(p.data); })
      .catch(() => setCats([]));
  };
  useEffect(() => { load(); }, []);

  const saveCategory = async () => {
    try {
      if (catForm.id) await api.put(`/merchant/menu/categories/${catForm.id}`, catForm);
      else await api.post("/merchant/menu/categories", { name: catForm.name, order: cats.length });
      setCatForm(null); load(); toast.success("Categoria salva");
    } catch (e) { toast.error(apiError(e)); }
  };

  const deleteCategory = async (c) => {
    if (!window.confirm(`Excluir a categoria "${c.name}" e todos os seus produtos?`)) return;
    await api.delete(`/merchant/menu/categories/${c.id}`);
    load(); toast.success("Categoria excluída");
  };

  const saveProduct = async () => {
    const payload = {
      ...prodForm,
      price: parseFloat(prodForm.price) || 0,
      promo_price: prodForm.promo_price ? parseFloat(prodForm.promo_price) : null,
      addons: prodForm.addons.filter((a) => a.name?.trim()),
    };
    try {
      if (prodForm.id) await api.put(`/merchant/menu/products/${prodForm.id}`, payload);
      else await api.post("/merchant/menu/products", payload);
      setProdForm(null); load(); toast.success("Produto salvo");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <DashboardLayout variant="top"
      menu={MERCHANT_MENU}
      title="Cardápio"
      subtitle="Categorias, produtos e adicionais"
      actions={<Button data-testid="add-category-button" onClick={() => setCatForm({ name: "" })} className="h-10 rounded-xl font-bold text-sm"><Plus className="w-4 h-4 mr-1" /> Categoria</Button>}
    >
      {!cats ? <Loading /> : (
        <div className="space-y-6">
          {cats.length === 0 && (
            <div className="bg-white rounded-2xl border p-10 text-center text-sm text-slate-400" data-testid="menu-empty">
              Comece criando uma categoria (ex: Marmitas, Lanches, Bebidas).
            </div>
          )}
          {cats.map((c) => (
            <section key={c.id} className="bg-white rounded-2xl border" data-testid={`menu-category-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <div className="flex items-center gap-2 p-4 border-b">
                <h3 className="font-display font-bold text-slate-900 flex-1">{c.name}</h3>
                <button onClick={() => setCatForm(c)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400" data-testid="edit-category"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deleteCategory(c)} className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500" data-testid="delete-category"><Trash2 className="w-4 h-4" /></button>
                <Button size="sm" data-testid={`add-product-${c.id.slice(0, 8)}`} onClick={() => setProdForm({ ...EMPTY_PRODUCT, category_id: c.id })} className="rounded-xl font-bold"><Plus className="w-4 h-4 mr-1" /> Produto</Button>
              </div>
              <div className="divide-y">
                {products.filter((p) => p.category_id === c.id).length === 0 && (
                  <p className="text-xs text-slate-400 px-4 py-4">Nenhum produto nesta categoria.</p>
                )}
                {products.filter((p) => p.category_id === c.id).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3" data-testid={`menu-product-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                      {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {fmtBRL(p.price)}{p.promo_price ? ` → promo ${fmtBRL(p.promo_price)}` : ""}
                        {p.addons?.length > 0 && ` • ${p.addons.length} adicionais`}
                      </p>
                    </div>
                    <button
                      onClick={() => api.post(`/merchant/menu/products/${p.id}/toggle`).then(load)}
                      data-testid={`toggle-product-${p.id.slice(0, 8)}`}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full ${p.available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      <Power className="w-3 h-3 inline mr-1" />{p.available ? "Disponível" : "Esgotado"}
                    </button>
                    <button onClick={() => api.post(`/merchant/menu/products/${p.id}/duplicate`).then(load)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400" data-testid="duplicate-product"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => setProdForm({ ...p, promo_price: p.promo_price ?? "" })} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400" data-testid="edit-product"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => window.confirm(`Excluir "${p.name}"?`) && api.delete(`/merchant/menu/products/${p.id}`).then(load)} className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500" data-testid="delete-product"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!catForm} onOpenChange={(v) => !v && setCatForm(null)}>
        <DialogContent className="max-w-sm rounded-2xl" data-testid="category-form-modal">
          <DialogHeader><DialogTitle className="font-display">{catForm?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <Input data-testid="category-name-input" placeholder="Ex: Marmitas" value={catForm?.name || ""} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="h-12 rounded-xl" />
          <Button data-testid="category-save-button" onClick={saveCategory} disabled={!catForm?.name?.trim()} className="h-12 rounded-xl font-bold">Salvar</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!prodForm} onOpenChange={(v) => !v && setProdForm(null)}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="product-form-modal">
          <DialogHeader><DialogTitle className="font-display">{prodForm?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {prodForm && (
            <div className="space-y-3">
              <Input data-testid="product-name-input" placeholder="Nome do produto *" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} className="h-12 rounded-xl" />
              <Textarea data-testid="product-desc-input" placeholder="Descrição" value={prodForm.description} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} rows={2} className="rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <Input data-testid="product-price-input" type="number" step="0.01" min="0" placeholder="Preço *" value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="product-promo-input" type="number" step="0.01" min="0" placeholder="Preço promo (opcional)" value={prodForm.promo_price} onChange={(e) => setProdForm({ ...prodForm, promo_price: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <ImageUpload testid="product-image-upload" label="Foto do produto (opcional)" value={prodForm.image} onChange={(url) => setProdForm({ ...prodForm, image: url })} />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-slate-700">Adicionais</p>
                  <button data-testid="add-addon-button" onClick={() => setProdForm({ ...prodForm, addons: [...prodForm.addons, { name: "", price: "" }] })} className="text-xs font-bold text-orange-600">+ Adicional</button>
                </div>
                {prodForm.addons.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Ex: Bacon" value={a.name} onChange={(e) => { const addons = [...prodForm.addons]; addons[i] = { ...a, name: e.target.value }; setProdForm({ ...prodForm, addons }); }} className="h-10 rounded-xl flex-1" data-testid={`addon-name-${i}`} />
                    <Input placeholder="R$" type="number" step="0.01" min="0" value={a.price} onChange={(e) => { const addons = [...prodForm.addons]; addons[i] = { ...a, price: e.target.value }; setProdForm({ ...prodForm, addons }); }} className="h-10 rounded-xl w-24" data-testid={`addon-price-${i}`} />
                    <button onClick={() => setProdForm({ ...prodForm, addons: prodForm.addons.filter((_, x) => x !== i) })} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <Button data-testid="product-save-button" onClick={saveProduct} disabled={!prodForm.name?.trim() || !prodForm.price} className="w-full h-12 rounded-xl font-bold">Salvar produto</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
