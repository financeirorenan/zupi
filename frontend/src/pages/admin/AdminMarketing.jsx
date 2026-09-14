import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError, fmtBRL } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Image, Ticket } from "lucide-react";

const EMPTY_BANNER = { title: "", subtitle: "", image: "", link: "", city: "", position: 0, active: true };
const EMPTY_COUPON = { code: "", type: "percent", value: "", min_order: "", city: "", max_uses: "", valid_until: "", first_purchase: false, active: true };

export default function AdminMarketing() {
  const [tab, setTab] = useState("banners");
  const [banners, setBanners] = useState(null);
  const [coupons, setCoupons] = useState(null);
  const [bannerForm, setBannerForm] = useState(null);
  const [couponForm, setCouponForm] = useState(null);
  const [cities, setCities] = useState([]);

  const loadBanners = () => api.get("/admin/banners").then((r) => setBanners(r.data));
  const loadCoupons = () => api.get("/admin/coupons").then((r) => setCoupons(r.data));
  useEffect(() => { loadBanners(); loadCoupons(); api.get("/cities").then((r) => setCities(r.data)).catch(() => {}); }, []);

  const saveBanner = async () => {
    try {
      if (bannerForm.id) await api.put(`/admin/banners/${bannerForm.id}`, bannerForm);
      else await api.post("/admin/banners", bannerForm);
      setBannerForm(null); loadBanners(); toast.success("Banner salvo");
    } catch (e) { toast.error(apiError(e)); }
  };

  const saveCoupon = async () => {
    try {
      await api.post("/admin/coupons", {
        ...couponForm, value: parseFloat(couponForm.value) || 0, min_order: parseFloat(couponForm.min_order) || 0,
        max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
        valid_until: couponForm.valid_until ? new Date(couponForm.valid_until).toISOString() : null,
      });
      setCouponForm(null); loadCoupons(); toast.success("Cupom global criado");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Marketing" subtitle="Banners da home e cupons globais">
      <div className="flex gap-2 mb-4">
        <button data-testid="tab-banners" onClick={() => setTab("banners")} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === "banners" ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}><Image className="w-4 h-4" /> Banners</button>
        <button data-testid="tab-cupons" onClick={() => setTab("cupons")} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === "cupons" ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}><Ticket className="w-4 h-4" /> Cupons globais</button>
      </div>

      {tab === "banners" && (
        <div className="space-y-4">
          <Button data-testid="add-banner-button" onClick={() => setBannerForm(EMPTY_BANNER)} className="h-10 rounded-xl font-bold text-sm"><Plus className="w-4 h-4 mr-1" /> Novo banner</Button>
          {!banners ? <Loading /> : (
            <div className="grid md:grid-cols-2 gap-4" data-testid="banners-list">
              {banners.map((b) => (
                <div key={b.id} className="bg-white rounded-2xl border overflow-hidden">
                  <div className="h-32 bg-slate-100 relative">
                    {b.image && <img src={b.image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full ${b.active ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"}`}>{b.active ? "Ativo" : "Inativo"}</span>
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 truncate">{b.title}</p>
                      <p className="text-xs text-slate-400 truncate">{b.subtitle} {b.city ? `• ${b.city}` : "• Todas as cidades"}</p>
                    </div>
                    <button onClick={() => setBannerForm({ ...b, start_date: b.start_date?.slice(0, 10) || "", end_date: b.end_date?.slice(0, 10) || "" })} className="text-xs font-bold text-orange-600" data-testid="edit-banner">Editar</button>
                    <button onClick={() => window.confirm("Excluir banner?") && api.delete(`/admin/banners/${b.id}`).then(loadBanners)} className="text-slate-300 hover:text-red-500" data-testid="delete-banner"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {banners.length === 0 && <p className="text-sm text-slate-400 col-span-2 text-center py-8">Nenhum banner criado.</p>}
            </div>
          )}
        </div>
      )}

      {tab === "cupons" && (
        <div className="space-y-4">
          <Button data-testid="add-global-coupon-button" onClick={() => setCouponForm(EMPTY_COUPON)} className="h-10 rounded-xl font-bold text-sm"><Plus className="w-4 h-4 mr-1" /> Novo cupom global</Button>
          {!coupons ? <Loading /> : (
            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]" data-testid="admin-coupons-table">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b">
                    <th className="p-4">Código</th><th className="p-4">Desconto</th><th className="p-4">Mínimo</th><th className="p-4">Escopo</th><th className="p-4">Usos</th><th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b last:border-0" data-testid={`admin-coupon-${c.code}`}>
                      <td className="p-4 font-bold">{c.code}</td>
                      <td className="p-4">{c.type === "percent" ? `${c.value}%` : fmtBRL(c.value)}</td>
                      <td className="p-4">{c.min_order > 0 ? fmtBRL(c.min_order) : "—"}</td>
                      <td className="p-4 text-slate-500">{c.restaurant_id ? "Restaurante" : c.city ? c.city : "Global"}</td>
                      <td className="p-4">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => window.confirm(`Excluir cupom ${c.code}?`) && api.delete(`/admin/coupons/${c.id}`).then(loadCoupons)} className="text-slate-300 hover:text-red-500" data-testid="delete-coupon"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!bannerForm} onOpenChange={(v) => !v && setBannerForm(null)}>
        <DialogContent className="max-w-md rounded-2xl" data-testid="banner-form-modal">
          <DialogHeader><DialogTitle className="font-display">{bannerForm?.id ? "Editar banner" : "Novo banner"}</DialogTitle></DialogHeader>
          {bannerForm && (
            <div className="space-y-3">
              <Input data-testid="banner-title" placeholder="Título *" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} className="h-12 rounded-xl" />
              <Input data-testid="banner-subtitle" placeholder="Subtítulo" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} className="h-12 rounded-xl" />
              <Input data-testid="banner-image" placeholder="URL da imagem" value={bannerForm.image} onChange={(e) => setBannerForm({ ...bannerForm, image: e.target.value })} className="h-12 rounded-xl" />
              <Input data-testid="banner-link" placeholder="Link (ex: /restaurante/abc)" value={bannerForm.link} onChange={(e) => setBannerForm({ ...bannerForm, link: e.target.value })} className="h-12 rounded-xl" />
              <select data-testid="banner-city" value={bannerForm.city || ""} onChange={(e) => setBannerForm({ ...bannerForm, city: e.target.value })} className="w-full h-12 rounded-xl border px-3 text-sm bg-white">
                <option value="">Todas as cidades</option>
                {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <Button data-testid="banner-save" onClick={saveBanner} disabled={!bannerForm.title} className="w-full h-12 rounded-xl font-bold">Salvar banner</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!couponForm} onOpenChange={(v) => !v && setCouponForm(null)}>
        <DialogContent className="max-w-sm rounded-2xl" data-testid="global-coupon-form">
          <DialogHeader><DialogTitle className="font-display">Novo cupom global</DialogTitle></DialogHeader>
          {couponForm && (
            <div className="space-y-3">
              <Input data-testid="gc-code" placeholder="Código *" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className="h-12 rounded-xl uppercase" />
              <div className="grid grid-cols-2 gap-2">
                <select value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })} className="h-12 rounded-xl border px-3 text-sm bg-white" data-testid="gc-type">
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
                <Input data-testid="gc-value" type="number" placeholder="Valor" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="gc-min" type="number" placeholder="Pedido mínimo" value={couponForm.min_order} onChange={(e) => setCouponForm({ ...couponForm, min_order: e.target.value })} className="h-12 rounded-xl" />
                <Input data-testid="gc-max" type="number" placeholder="Limite de usos" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <select data-testid="gc-city" value={couponForm.city || ""} onChange={(e) => setCouponForm({ ...couponForm, city: e.target.value })} className="w-full h-12 rounded-xl border px-3 text-sm bg-white">
                <option value="">Todas as cidades</option>
                {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={couponForm.first_purchase} onChange={(e) => setCouponForm({ ...couponForm, first_purchase: e.target.checked })} data-testid="gc-first" /> Só primeira compra
              </label>
              <Button data-testid="gc-save" onClick={saveCoupon} disabled={!couponForm.code || !couponForm.value} className="w-full h-12 rounded-xl font-bold">Criar cupom</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
