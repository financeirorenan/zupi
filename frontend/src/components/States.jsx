import { Loader2, ShoppingBag } from "lucide-react";

export function Loading({ text = "Carregando..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" data-testid="loading-state">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = ShoppingBag, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3" data-testid="empty-state">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
        <Icon className="w-8 h-8 text-orange-500" />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-800">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs">{description}</p>}
      {children}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border animate-pulse">
      <div className="h-36 bg-slate-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}
