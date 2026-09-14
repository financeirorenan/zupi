import { Link } from "react-router-dom";
import { Clock, Bike, Sparkles } from "lucide-react";
import Stars from "@/components/Stars";
import { fmtBRL } from "@/lib/api";

export default function RestaurantCard({ r }) {
  return (
    <Link
      to={`/restaurante/${r.id}`}
      data-testid={`restaurant-card-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className={`block bg-white rounded-2xl overflow-hidden border hover:shadow-xl hover:shadow-orange-100 hover:-translate-y-0.5 transition-all duration-200 ${!r.is_open ? "opacity-75" : ""}`}
    >
      <div className="relative h-36 sm:h-40 overflow-hidden bg-slate-100">
        {r.cover ? (
          <img src={r.cover} alt={r.name} className={`w-full h-full object-cover ${!r.is_open ? "grayscale" : ""}`} loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200" />
        )}
        {r.featured && (
          <span className="absolute top-3 left-3 bg-orange-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Destaque
          </span>
        )}
        {!r.is_open && (
          <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full">Fechado agora</span>
          </span>
        )}
        {(r.delivery_fee === 0) && (
          <span className="absolute bottom-3 left-3 bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
            Entrega grátis
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-bold text-slate-900 leading-tight">{r.name}</h3>
          <Stars rating={r.rating} count={r.rating_count} />
        </div>
        <p className="text-xs text-slate-500 mt-1">{r.category} • {r.city}</p>
        <div className="flex items-center gap-4 mt-3 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-orange-500" />{r.prep_time}-{r.prep_time + 15} min</span>
          <span className="flex items-center gap-1"><Bike className="w-3.5 h-3.5 text-orange-500" />{r.delivery_fee > 0 ? fmtBRL(r.delivery_fee) : "Grátis"}</span>
          {r.min_order > 0 && <span className="text-slate-400">Mín. {fmtBRL(r.min_order)}</span>}
        </div>
      </div>
    </Link>
  );
}
