import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Bike, MapPin, Heart, ShoppingCart, Info } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import ProductModal from "@/components/ProductModal";
import Stars from "@/components/Stars";
import { Loading } from "@/components/States";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { api, fmtBRL, fmtDateTime, apiError } from "@/lib/api";
import { toast } from "sonner";

export default function RestaurantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, count, subtotal } = useCart();
  const [data, setData] = useState(null);
  const [product, setProduct] = useState(null);
  const [fav, setFav] = useState(false);
  const [activeCat, setActiveCat] = useState("");

  useEffect(() => {
    setData(null);
    api.get(`/restaurants/${id}`).then((r) => {
      setData(r.data);
      setActiveCat(r.data.menu[0]?.id || "");
    }).catch(() => toast.error("Restaurante não encontrado"));
    if (user) {
      api.get("/favorites").then((r) => setFav(r.data.some((f) => f.id === id))).catch(() => {});
    }
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) return navigate(`/entrar?next=/restaurante/${id}`);
    try {
      if (fav) await api.delete(`/favorites/${id}`);
      else await api.post(`/favorites/${id}`);
      setFav(!fav);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!data) return <CustomerLayout><Loading /></CustomerLayout>;
  const { restaurant: r, menu, reviews } = data;
  const cartHere = cart && cart.restaurantId === r.id && count > 0;

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto">
        <div className="relative h-44 sm:h-56 bg-slate-200">
          {r.cover && <img src={r.cover} alt={r.name} className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button onClick={() => navigate(-1)} data-testid="back-button" className="absolute top-4 left-4 w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={toggleFav} data-testid="favorite-toggle" className="absolute top-4 right-4 w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow">
            <Heart className={`w-5 h-5 ${fav ? "text-orange-600" : "text-slate-400"}`} fill={fav ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="px-4 -mt-8 relative">
          <div className="bg-white rounded-2xl border shadow-sm p-5" data-testid="restaurant-header">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-display font-extrabold text-xl text-slate-900">{r.name}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{r.category} • {r.city}</p>
              </div>
              <Stars rating={r.rating} count={r.rating_count} />
            </div>
            {r.description && <p className="text-sm text-slate-600 mt-2">{r.description}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm font-medium text-slate-600">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-500" />{r.prep_time}-{r.prep_time + 15} min</span>
              <span className="flex items-center gap-1.5"><Bike className="w-4 h-4 text-orange-500" />{r.delivery_fee > 0 ? fmtBRL(r.delivery_fee) : "Entrega grátis"}</span>
              {r.min_order > 0 && <span className="text-slate-500">Mínimo {fmtBRL(r.min_order)}</span>}
              <span className={`font-bold ${r.is_open ? "text-emerald-600" : "text-red-500"}`} data-testid="restaurant-open-status">
                {r.is_open ? "Aberto agora" : "Fechado"}
              </span>
            </div>
            {r.address?.street && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
                <MapPin className="w-3.5 h-3.5" />{r.address.street}, {r.address.number} — {r.address.district}
              </p>
            )}
          </div>
        </div>

        {menu.length > 0 && (
          <div className="sticky top-16 z-20 bg-[#F8F9FA] pt-3 pb-2 px-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="menu-category-nav">
              {menu.map((c) => (
                <button
                  key={c.id}
                  data-testid={`menu-cat-${c.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}`}
                  onClick={() => {
                    setActiveCat(c.id);
                    document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`shrink-0 h-10 px-4 rounded-full text-sm font-bold border ${activeCat === c.id ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 space-y-8 mt-4 pb-8">
          {menu.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32">
              <h2 className="font-display font-bold text-lg text-slate-900 mb-3">{c.name}</h2>
              <div className="space-y-3">
                {c.products.map((p) => (
                  <button
                    key={p.id}
                    data-testid={`product-card-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    onClick={() => {
                      if (!r.is_open) { toast.info("Este restaurante está fechado no momento"); return; }
                      if (p.available) setProduct(p);
                    }}
                    disabled={!p.available}
                    className={`w-full flex gap-3 bg-white rounded-2xl border p-3 text-left transition-shadow hover:shadow-md ${!p.available ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        {p.promo_price && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">PROMO</span>}
                        {!p.available && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Esgotado</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                      <div className="mt-2">
                        {p.promo_price && <span className="text-xs text-slate-400 line-through mr-2">{fmtBRL(p.price)}</span>}
                        <span className="font-display font-bold text-orange-600">{fmtBRL(p.promo_price || p.price)}</span>
                      </div>
                    </div>
                    {p.image && (
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {reviews.length > 0 && (
            <section>
              <h2 className="font-display font-bold text-lg text-slate-900 mb-3">Avaliações</h2>
              <div className="space-y-3">
                {reviews.map((rv) => (
                  <div key={rv.id} className="bg-white rounded-2xl border p-4" data-testid={`review-${rv.id.slice(0, 8)}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-slate-800">{rv.customer_name}</p>
                      <Stars rating={rv.rating} />
                    </div>
                    {rv.comment && <p className="text-sm text-slate-600 mt-1.5">{rv.comment}</p>}
                    <p className="text-[11px] text-slate-400 mt-2">{fmtDateTime(rv.created_at)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3 text-sm text-orange-800">
            <Info className="w-5 h-5 shrink-0" />
            <p>Este restaurante paga apenas <b>R$ 2,00 por pedido</b> ao Zupi — mais do seu dinheiro fica no comércio local.</p>
          </div>
        </div>
      </div>

      {cartHere && (
        <div className="fixed bottom-16 md:bottom-6 inset-x-0 z-30 px-4 flex justify-center">
          <button
            onClick={() => navigate("/carrinho")}
            data-testid="view-cart-bar"
            className="w-full max-w-md h-14 bg-orange-600 text-white rounded-2xl shadow-xl shadow-orange-600/30 flex items-center justify-between px-5 font-bold hover:bg-orange-700 transition-colors"
          >
            <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Ver carrinho ({count})</span>
            <span>{fmtBRL(subtotal)}</span>
          </button>
        </div>
      )}

      <ProductModal product={product} restaurant={r} open={!!product} onClose={() => setProduct(null)} />
    </CustomerLayout>
  );
}
