import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import Stars from "@/components/Stars";
import { Loading, EmptyState } from "@/components/States";
import { api, fmtDateTime } from "@/lib/api";
import { Star } from "lucide-react";

export default function MerchantReviews() {
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    api.get("/merchant/reviews").then((r) => setReviews(r.data)).catch(() => setReviews([]));
  }, []);

  const avg = reviews?.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <DashboardLayout menu={MERCHANT_MENU} title="Avaliações" subtitle={avg ? `Média ${avg} em ${reviews.length} avaliações` : "O que seus clientes dizem"}>
      {!reviews ? <Loading /> : reviews.length === 0 ? (
        <EmptyState icon={Star} title="Sem avaliações ainda" description="Avaliações aparecem aqui após pedidos entregues." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border p-5" data-testid={`merchant-review-${r.id.slice(0, 8)}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-slate-800">{r.customer_name}</p>
                <Stars rating={r.rating} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span>Comida: <b>{r.food_rating}/5</b></span>
                <span>Entrega: <b>{r.delivery_rating}/5</b></span>
              </div>
              {r.comment && <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-xl p-3">"{r.comment}"</p>}
              <p className="text-[11px] text-slate-400 mt-2">{fmtDateTime(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
