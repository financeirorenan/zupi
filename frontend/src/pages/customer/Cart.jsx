import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, Ticket, ShoppingBag, ArrowLeft } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import { EmptyState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { api, fmtBRL, apiError } from "@/lib/api";
import { toast } from "sonner";

export default function Cart() {
  const { cart, updateQty, removeItem, clear, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);

  const applyCoupon = async () => {
    if (!user) {
      toast.info("Entre na sua conta para usar cupons");
      return navigate(`/entrar?next=/carrinho`);
    }
    try {
      const { data } = await api.post("/coupons/validate", { code: coupon, subtotal, restaurant_id: cart.restaurantId });
      setApplied(data);
      toast.success(`Cupom ${data.code} aplicado: -${fmtBRL(data.discount)}`);
    } catch (e) {
      setApplied(null);
      toast.error(apiError(e));
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <CustomerLayout>
        <EmptyState icon={ShoppingBag} title="Seu carrinho está vazio" description="Explore os restaurantes da sua cidade e faça seu pedido.">
          <Link to="/app"><Button data-testid="empty-cart-explore" className="rounded-xl font-bold h-12 px-6 mt-2">Explorar restaurantes</Button></Link>
        </EmptyState>
      </CustomerLayout>
    );
  }

  const discount = applied?.discount || 0;
  const total = Math.max(subtotal - discount, 0) + cart.deliveryFee;

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-11 h-11 rounded-xl bg-white border flex items-center justify-center" data-testid="cart-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-extrabold text-2xl text-slate-900" data-testid="cart-title">Seu carrinho</h1>
            <p className="text-sm text-slate-500">{cart.restaurantName}</p>
          </div>
          <div className="flex-1" />
          <button onClick={clear} data-testid="clear-cart-button" className="text-sm text-red-500 font-semibold flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Limpar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {cart.items.map((i) => (
            <div key={i.key} className="bg-white rounded-2xl border p-4 flex gap-3" data-testid={`cart-item-${i.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{i.name}</p>
                {i.addons?.length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">+ {i.addons.map((a) => a.name).join(", ")}</p>
                )}
                {i.notes && <p className="text-xs text-slate-400 italic mt-0.5">"{i.notes}"</p>}
                <p className="font-display font-bold text-orange-600 mt-1.5">{fmtBRL(i.unit_price * i.qty)}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button onClick={() => removeItem(i.key)} className="text-slate-300 hover:text-red-500" data-testid="cart-item-remove"><Trash2 className="w-4 h-4" /></button>
                <div className="flex items-center border rounded-xl">
                  <button onClick={() => updateQty(i.key, -1)} className="w-9 h-9 flex items-center justify-center text-orange-600" data-testid="cart-item-minus"><Minus className="w-4 h-4" /></button>
                  <span className="w-7 text-center text-sm font-bold">{i.qty}</span>
                  <button onClick={() => updateQty(i.key, 1)} className="w-9 h-9 flex items-center justify-center text-orange-600" data-testid="cart-item-plus"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border p-4 mt-5">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Ticket className="w-4 h-4 text-orange-500" /> Cupom de desconto</p>
          <div className="flex gap-2 mt-2">
            <Input data-testid="coupon-input" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Ex: ZUPI10" className="h-11 rounded-xl uppercase" />
            <Button data-testid="apply-coupon-button" onClick={applyCoupon} variant="outline" className="h-11 rounded-xl font-bold">Aplicar</Button>
          </div>
          {applied && <p className="text-xs text-emerald-600 font-bold mt-2" data-testid="coupon-applied">{applied.code} aplicado: -{fmtBRL(applied.discount)}</p>}
        </div>

        <div className="bg-white rounded-2xl border p-4 mt-4 space-y-2 text-sm" data-testid="cart-summary">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmtBRL(subtotal)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Taxa de entrega</span><span>{cart.deliveryFee > 0 ? fmtBRL(cart.deliveryFee) : "Grátis"}</span></div>
          {discount > 0 && <div className="flex justify-between text-emerald-600 font-semibold"><span>Cupom</span><span>-{fmtBRL(discount)}</span></div>}
          <div className="border-t pt-2 flex justify-between font-display font-extrabold text-lg text-slate-900">
            <span>Total</span><span data-testid="cart-total">{fmtBRL(total)}</span>
          </div>
        </div>

        {cart.minOrder > 0 && subtotal < cart.minOrder && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-4" data-testid="min-order-warning">
            Pedido mínimo de {fmtBRL(cart.minOrder)} neste restaurante. Faltam {fmtBRL(cart.minOrder - subtotal)}.
          </p>
        )}

        <Button
          data-testid="go-checkout-button"
          disabled={cart.minOrder > 0 && subtotal < cart.minOrder}
          onClick={() => navigate("/checkout", { state: { coupon: applied?.code } })}
          className="w-full h-14 rounded-2xl font-bold text-base mt-5"
        >
          Continuar • {fmtBRL(total)}
        </Button>
      </div>
    </CustomerLayout>
  );
}
