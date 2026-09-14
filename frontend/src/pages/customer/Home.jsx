import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, ChevronRight } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import RestaurantCard from "@/components/RestaurantCard";
import { CardSkeleton } from "@/components/States";
import { useCity } from "@/context/CityContext";
import { api } from "@/lib/api";

const SORTS = [
  { id: "rating", label: "Melhor avaliação" },
  { id: "delivery_fee", label: "Menor taxa" },
  { id: "time", label: "Mais rápido" },
  { id: "orders", label: "Mais pedidos" },
];

export default function Home() {
  const { city } = useCity();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [restaurants, setRestaurants] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState({ open: false, free: false, sort: "rating" });
  const [showSort, setShowSort] = useState(false);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!city) return;
    api.get("/banners", { params: { city } }).then((r) => setBanners(r.data)).catch(() => {});
  }, [city]);

  useEffect(() => {
    if (!city) return;
    setRestaurants(null);
    api.get("/restaurants", {
      params: { city, open_now: filter.open, free_delivery: filter.free, sort: filter.sort },
    }).then((r) => setRestaurants(r.data)).catch(() => setRestaurants([]));
  }, [city, filter]);

  const featured = restaurants?.filter((r) => r.featured) || [];

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="pt-6 pb-2">
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900" data-testid="home-greeting">
            Olá! O que vai pedir hoje?
          </h1>
          <p className="text-sm text-slate-500 mt-1">Restaurantes de {city || "sua cidade"} entregando para você.</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/buscar?q=${encodeURIComponent(q.trim())}`); }}
          className="relative mt-3"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            data-testid="home-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busque por parmegiana, pizza, açaí..."
            className="w-full h-14 pl-12 pr-4 rounded-2xl border bg-white text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </form>

        {banners.length > 0 && (
          <div className="flex gap-3 overflow-x-auto no-scrollbar mt-5 -mx-3 px-3 sm:mx-0 sm:px-0" data-testid="banners-carousel">
            {banners.map((b) => (
              <button
                key={b.id}
                data-testid={`banner-${b.id.slice(0, 8)}`}
                onClick={() => b.link && navigate(b.link)}
                className="relative shrink-0 w-[85vw] sm:w-[520px] h-40 rounded-2xl overflow-hidden text-left"
              >
                <img src={b.image} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
                <div className="relative p-5 flex flex-col justify-center h-full max-w-[70%]">
                  <p className="font-display font-extrabold text-white text-lg leading-tight">{b.title}</p>
                  <p className="text-white/80 text-xs mt-1">{b.subtitle}</p>
                  <span className="mt-2 inline-flex items-center text-orange-300 text-xs font-bold">Pedir agora <ChevronRight className="w-3 h-3" /></span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 overflow-x-auto no-scrollbar mt-6 -mx-3 px-3 sm:mx-0 sm:px-0" data-testid="categories-row">
          {categories.map((c) => (
            <button
              key={c.id}
              data-testid={`category-chip-${c.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}`}
              onClick={() => navigate(`/buscar?categoria=${encodeURIComponent(c.name)}`)}
              className="shrink-0 flex flex-col items-center gap-1.5 w-20"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-orange-50 border shadow-sm">
                {c.image && <img src={c.image} alt={c.name} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-7 overflow-x-auto no-scrollbar" data-testid="home-filters">
          <button
            data-testid="filter-open-now"
            onClick={() => setFilter((f) => ({ ...f, open: !f.open }))}
            className={`shrink-0 h-10 px-4 rounded-full text-sm font-semibold border transition-colors ${filter.open ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600"}`}
          >
            Aberto agora
          </button>
          <button
            data-testid="filter-free-delivery"
            onClick={() => setFilter((f) => ({ ...f, free: !f.free }))}
            className={`shrink-0 h-10 px-4 rounded-full text-sm font-semibold border transition-colors ${filter.free ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-600"}`}
          >
            Entrega grátis
          </button>
          <div className="relative">
            <button
              data-testid="filter-sort"
              onClick={() => setShowSort((s) => !s)}
              className="shrink-0 h-10 px-4 rounded-full text-sm font-semibold border bg-white text-slate-600 flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4" /> {SORTS.find((s) => s.id === filter.sort)?.label}
            </button>
            {showSort && (
              <div className="absolute top-12 left-0 z-20 bg-white border rounded-xl shadow-lg p-1.5 w-48" data-testid="sort-menu">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    data-testid={`sort-${s.id}`}
                    onClick={() => { setFilter((f) => ({ ...f, sort: s.id })); setShowSort(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${filter.sort === s.id ? "bg-orange-50 text-orange-700" : "hover:bg-slate-50"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {featured.length > 0 && (
          <div className="mt-7">
            <h2 className="font-display font-bold text-lg text-slate-900" data-testid="featured-section">Destaques da sua cidade</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar mt-3 -mx-3 px-3 sm:mx-0 sm:px-0">
              {featured.map((r) => (
                <div key={r.id} className="shrink-0 w-72">
                  <RestaurantCard r={r} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-7">
          <h2 className="font-display font-bold text-lg text-slate-900" data-testid="all-restaurants-section">Restaurantes em {city}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            {restaurants === null && [1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            {restaurants?.map((r) => <RestaurantCard key={r.id} r={r} />)}
          </div>
          {restaurants?.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12" data-testid="no-restaurants">Nenhum restaurante encontrado com esses filtros.</p>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
