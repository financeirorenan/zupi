import { Star } from "lucide-react";

export default function Stars({ rating = 0, count, size = "w-4 h-4" }) {
  return (
    <span className="inline-flex items-center gap-1" data-testid="rating-stars">
      <Star className={`${size} text-amber-400`} fill="currentColor" />
      <span className="text-sm font-bold text-slate-800">{rating ? rating.toFixed(1) : "Novo"}</span>
      {count !== undefined && <span className="text-xs text-slate-400">({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" data-testid="star-input">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" data-testid={`star-input-${n}`} onClick={() => onChange(n)} className="p-1">
          <Star className={`w-8 h-8 ${n <= value ? "text-amber-400" : "text-slate-300"}`} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}
