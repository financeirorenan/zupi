import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import RestaurantCard from "@/components/RestaurantCard";
import { Loading, EmptyState } from "@/components/States";
import { api } from "@/lib/api";

export default function Favorites() {
  const [favs, setFavs] = useState(null);

  useEffect(() => {
    api.get("/favorites").then((r) => setFavs(r.data)).catch(() => setFavs([]));
  }, []);

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-6">
        <h1 className="font-display font-extrabold text-2xl text-slate-900" data-testid="favorites-title">Meus favoritos</h1>
        {!favs && <Loading />}
        {favs?.length === 0 && (
          <EmptyState icon={Heart} title="Nenhum favorito ainda" description="Toque no coração de um restaurante para salvá-lo aqui." />
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {favs?.map((r) => <RestaurantCard key={r.id} r={r} />)}
        </div>
      </div>
    </CustomerLayout>
  );
}
