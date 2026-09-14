import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import RestaurantCard from "@/components/RestaurantCard";
import { Loading, EmptyState } from "@/components/States";
import { useCity } from "@/context/CityContext";
import { api, fmtBRL } from "@/lib/api";

export default function SearchPage() {
  const { city } = useCity();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [result, setResult] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);

  const categoria = params.get("categoria") || "";

  useEffect(() => {
    const term = params.get("q") || "";
    setQ(term);
    setResult(null);
    if (term) {
      api.get("/search", { params: { q: term, city } }).then((r) => setResult(r.data)).catch(() => setResult({ restaurants: [], products: [] }));
    } else {
      api.get("/restaurants", { params: { city, category: categoria || undefined } })
        .then((r) => setResult({ restaurants: r.data, products: [] }))
        .catch(() => setResult({ restaurants: [], products: [] }));
    }
  }, [params, city, categoria]);

  const submit = (e) => {
    e.preventDefault();
    setParams(q.trim() ? { q: q.trim() } : {});
  };

  const restaurants = (result?.restaurants || []).filter((r) => !openOnly || r.is_open);

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-5">
        <form onSubmit={submit} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            data-testid="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Restaurante, prato, ingrediente..."
            autoFocus
            className="w-full h-14 pl-12 pr-4 rounded-2xl border bg-white text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </form>

        <div className="flex items-center gap-2 mt-4">
          {categoria && (
            <span className="h-9 px-3 rounded-full bg-orange-50 text-orange-700 text-sm font-bold flex items-center gap-2" data-testid="active-category-filter">
              {categoria}
              <button onClick={() => setParams({})} className="text-orange-400" data-testid="clear-category-filter">✕</button>
            </span>
          )}
          <button
            data-testid="search-filter-open"
            onClick={() => setOpenOnly((v) => !v)}
            className={`h-9 px-4 rounded-full text-sm font-semibold border ${openOnly ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600"}`}
          >
            Aberto agora
          </button>
        </div>

        {!result && <Loading text="Buscando..." />}

        {result?.products?.length > 0 && (
          <div className="mt-6">
            <h2 className="font-display font-bold text-lg text-slate-900">Pratos encontrados</h2>
            <div className="mt-3 space-y-2">
              {result.products.map((p) => (
                <Link
                  key={p.id}
                  to={`/restaurante/${p.restaurant_id}`}
                  data-testid={`product-result-${p.id.slice(0, 8)}`}
                  className="flex items-center gap-3 bg-white rounded-2xl border p-3 hover:shadow-md transition-shadow"
                >
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {p.image && <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.description}</p>
                  </div>
                  <span className="font-display font-bold text-orange-600 text-sm shrink-0">{fmtBRL(p.promo_price || p.price)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <h2 className="font-display font-bold text-lg text-slate-900">Restaurantes ({restaurants.length})</h2>
            {restaurants.length === 0 ? (
              <EmptyState icon={Search} title="Nada por aqui" description="Tente outro termo ou categoria." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                {restaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
