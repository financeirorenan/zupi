import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Receipt, RotateCcw, ChevronRight } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import StatusBadge from "@/components/StatusBadge";
import { Loading, EmptyState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { api, fmtBRL, fmtDateTime, apiError } from "@/lib/api";
import { toast } from "sonner";

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const { replaceCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/orders/mine").then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, []);

  const reorder = async (order) => {
    try {
      const { data } = await api.post(`/orders/${order.id}/reorder`);
      if (!data.items.length) {
        toast.error("Nenhum item deste pedido está disponível no momento");
        return;
      }
      const { data: detail } = await api.get(`/restaurants/${data.restaurant_id}`);
      replaceCart(detail.restaurant, data.items);
      toast.success("Carrinho remontado com os itens disponíveis");
      navigate("/carrinho");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-6">
        <h1 className="font-display font-extrabold text-2xl text-slate-900" data-testid="orders-title">Meus pedidos</h1>
        {!orders && <Loading />}
        {orders?.length === 0 && (
          <EmptyState icon={Receipt} title="Nenhum pedido ainda" description="Que tal pedir algo gostoso hoje?">
            <Link to="/app"><Button data-testid="orders-explore" className="rounded-xl font-bold h-12 px-6 mt-2">Explorar restaurantes</Button></Link>
          </EmptyState>
        )}
        <div className="space-y-3 mt-5">
          {orders?.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border p-4" data-testid={`order-card-${o.code.replace("#", "")}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{o.restaurant_name}</p>
                  <p className="text-xs text-slate-400">{o.code} • {fmtDateTime(o.created_at)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                {o.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="font-display font-extrabold text-orange-600">{fmtBRL(o.total)}</span>
                <div className="flex gap-2">
                  {o.status === "DELIVERED" && (
                    <Button variant="outline" size="sm" data-testid={`reorder-${o.code.replace("#", "")}`} onClick={() => reorder(o)} className="rounded-xl font-bold">
                      <RotateCcw className="w-4 h-4 mr-1" /> Pedir novamente
                    </Button>
                  )}
                  <Button size="sm" data-testid={`track-${o.code.replace("#", "")}`} onClick={() => navigate(`/pedido/${o.id}`)} className="rounded-xl font-bold">
                    {["DELIVERED", "CANCELLED"].includes(o.status) ? "Detalhes" : "Acompanhar"} <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
}
