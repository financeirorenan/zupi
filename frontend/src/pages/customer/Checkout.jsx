import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bike, Store, MapPin, CreditCard, Banknote, QrCode, Check, Plus } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/context/CartContext";
import { api, fmtBRL, apiError } from "@/lib/api";
import { toast } from "sonner";

const PAYMENTS = [
  { id: "pix", label: "Pix", desc: "Chave copia e cola no acompanhamento", icon: QrCode },
  { id: "card_machine", label: "Cartão na entrega", desc: "Crédito ou débito na maquininha", icon: CreditCard },
  { id: "cash", label: "Dinheiro", desc: "Pagamento na entrega", icon: Banknote },
  { id: "online", label: "Pagamento online", desc: "Em breve com gateway integrado", icon: CreditCard },
];

const EMPTY_ADDR = { label: "Casa", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "SP", reference: "" };

export default function Checkout() {
  const { cart, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const couponCode = location.state?.coupon || null;

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [newAddr, setNewAddr] = useState(EMPTY_ADDR);
  const [showNew, setShowNew] = useState(false);
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [payment, setPayment] = useState("pix");
  const [changeFor, setChangeFor] = useState("");
  const [discount, setDiscount] = useState(0);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cart) return;
    api.get("/addresses").then((r) => {
      setAddresses(r.data);
      if (r.data.length) setAddressId(r.data[0].id);
      else setShowNew(true);
    }).catch(() => {});
    api.get(`/restaurants/${cart.restaurantId}`).then((r) => setRestaurant(r.data.restaurant)).catch(() => {});
    if (couponCode) {
      api.post("/coupons/validate", { code: couponCode, subtotal, restaurant_id: cart.restaurantId })
        .then((r) => setDiscount(r.data.discount))
        .catch(() => setDiscount(0));
    }
  }, []);

  const deliveryFee = useMemo(() => {
    if (deliveryType === "pickup") return 0;
    if (!restaurant) return cart?.deliveryFee || 0;
    const addr = showNew ? newAddr : addresses.find((a) => a.id === addressId);
    const zone = restaurant.delivery_zones?.find((z) => z.district?.toLowerCase() === addr?.district?.toLowerCase());
    return zone ? zone.fee : restaurant.delivery_fee;
  }, [deliveryType, restaurant, addressId, newAddr, showNew, addresses, cart]);

  if (!cart || cart.items.length === 0) {
    navigate("/carrinho");
    return null;
  }

  const total = Math.max(subtotal - discount, 0) + deliveryFee;
  const selectedAddress = showNew ? newAddr : addresses.find((a) => a.id === addressId);
  const addressValid = deliveryType === "pickup" || (selectedAddress?.street && selectedAddress?.district && selectedAddress?.city);

  const confirm = async () => {
    setLoading(true);
    try {
      if (showNew && deliveryType === "delivery") {
        await api.post("/addresses", selectedAddress).catch(() => {});
      }
      const { data: order } = await api.post("/orders", {
        restaurant_id: cart.restaurantId,
        items: cart.items.map((i) => ({ product_id: i.product_id, qty: i.qty, addons: i.addons.map((a) => a.id), notes: i.notes })),
        delivery_type: deliveryType,
        address: deliveryType === "delivery" ? selectedAddress : null,
        payment_method: payment,
        coupon_code: couponCode,
        change_for: payment === "cash" && changeFor ? parseFloat(changeFor) : null,
      });
      clear();
      toast.success("Pedido enviado para o restaurante!");
      navigate(`/pedido/${order.id}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const StepDot = ({ n, label }) => (
    <div className="flex items-center gap-2">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= n ? "bg-orange-600 text-white" : "bg-slate-200 text-slate-500"}`}>
        {step > n ? <Check className="w-4 h-4" /> : n}
      </span>
      <span className={`text-sm font-semibold hidden sm:block ${step >= n ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
    </div>
  );

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-6">
        <div className="flex items-center gap-3">
          <button onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))} className="w-11 h-11 rounded-xl bg-white border flex items-center justify-center" data-testid="checkout-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-extrabold text-2xl text-slate-900">Finalizar pedido</h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 mt-5" data-testid="checkout-steps">
          <StepDot n={1} label="Entrega" />
          <div className="flex-1 h-px bg-slate-200" />
          <StepDot n={2} label="Pagamento" />
          <div className="flex-1 h-px bg-slate-200" />
          <StepDot n={3} label="Revisão" />
        </div>

        {step === 1 && (
          <div className="mt-6 space-y-4" data-testid="step-delivery">
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="delivery-type-delivery"
                onClick={() => setDeliveryType("delivery")}
                className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 font-bold text-sm ${deliveryType === "delivery" ? "border-orange-600 bg-orange-50 text-orange-700" : "bg-white text-slate-500"}`}
              >
                <Bike className="w-6 h-6" /> Entrega
              </button>
              <button
                data-testid="delivery-type-pickup"
                onClick={() => setDeliveryType("pickup")}
                className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 font-bold text-sm ${deliveryType === "pickup" ? "border-orange-600 bg-orange-50 text-orange-700" : "bg-white text-slate-500"}`}
              >
                <Store className="w-6 h-6" /> Retirar no local
              </button>
            </div>

            {deliveryType === "delivery" && (
              <div className="bg-white rounded-2xl border p-4 space-y-3">
                <p className="font-bold text-sm text-slate-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500" /> Endereço de entrega</p>
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    data-testid={`address-option-${a.id.slice(0, 8)}`}
                    onClick={() => { setAddressId(a.id); setShowNew(false); }}
                    className={`w-full text-left rounded-xl border-2 p-3 ${!showNew && addressId === a.id ? "border-orange-600 bg-orange-50" : ""}`}
                  >
                    <p className="font-bold text-sm">{a.label}</p>
                    <p className="text-xs text-slate-500">{a.street}, {a.number} — {a.district}, {a.city}</p>
                  </button>
                ))}
                <button
                  data-testid="new-address-toggle"
                  onClick={() => setShowNew(true)}
                  className={`w-full text-left rounded-xl border-2 border-dashed p-3 text-sm font-semibold text-slate-500 flex items-center gap-2 ${showNew ? "border-orange-600 text-orange-700 bg-orange-50" : ""}`}
                >
                  <Plus className="w-4 h-4" /> Novo endereço
                </button>
                {showNew && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input data-testid="addr-street" placeholder="Rua *" value={newAddr.street} onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })} className="col-span-2 h-11 rounded-xl" />
                    <Input data-testid="addr-number" placeholder="Número" value={newAddr.number} onChange={(e) => setNewAddr({ ...newAddr, number: e.target.value })} className="h-11 rounded-xl" />
                    <Input data-testid="addr-district" placeholder="Bairro *" value={newAddr.district} onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })} className="h-11 rounded-xl" />
                    <Input data-testid="addr-city" placeholder="Cidade *" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} className="h-11 rounded-xl" />
                    <Input data-testid="addr-cep" placeholder="CEP" value={newAddr.cep} onChange={(e) => setNewAddr({ ...newAddr, cep: e.target.value })} className="h-11 rounded-xl" />
                    <Input data-testid="addr-complement" placeholder="Complemento" value={newAddr.complement} onChange={(e) => setNewAddr({ ...newAddr, complement: e.target.value })} className="col-span-2 h-11 rounded-xl" />
                    <Input data-testid="addr-reference" placeholder="Ponto de referência" value={newAddr.reference} onChange={(e) => setNewAddr({ ...newAddr, reference: e.target.value })} className="col-span-2 h-11 rounded-xl" />
                  </div>
                )}
              </div>
            )}

            {deliveryType === "pickup" && restaurant?.address && (
              <div className="bg-white rounded-2xl border p-4">
                <p className="font-bold text-sm text-slate-800 mb-1">Retirada em:</p>
                <p className="text-sm text-slate-600">{restaurant.address.street}, {restaurant.address.number} — {restaurant.address.district}, {restaurant.city}</p>
                <p className="text-xs text-slate-400 mt-1">Você receberá um código de retirada após a confirmação.</p>
              </div>
            )}

            <Button data-testid="step1-next" disabled={!addressValid} onClick={() => setStep(2)} className="w-full h-14 rounded-2xl font-bold text-base">
              Continuar para pagamento
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-3" data-testid="step-payment">
            {PAYMENTS.map((p) => (
              <button
                key={p.id}
                data-testid={`payment-${p.id}`}
                onClick={() => setPayment(p.id)}
                className={`w-full flex items-center gap-4 rounded-2xl border-2 p-4 text-left ${payment === p.id ? "border-orange-600 bg-orange-50" : "bg-white"}`}
              >
                <p.icon className={`w-6 h-6 ${payment === p.id ? "text-orange-600" : "text-slate-400"}`} />
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-800">{p.label}</p>
                  <p className="text-xs text-slate-500">{p.desc}</p>
                </div>
                {payment === p.id && <Check className="w-5 h-5 text-orange-600" />}
              </button>
            ))}
            {payment === "cash" && (
              <div className="bg-white rounded-2xl border p-4">
                <label className="text-sm font-semibold text-slate-700">Troco para quanto? (opcional)</label>
                <Input data-testid="change-for-input" type="number" min="0" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Ex: 50" className="mt-1 h-11 rounded-xl" />
              </div>
            )}
            <Button data-testid="step2-next" onClick={() => setStep(3)} className="w-full h-14 rounded-2xl font-bold text-base">Revisar pedido</Button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4" data-testid="step-review">
            <div className="bg-white rounded-2xl border p-4 space-y-3">
              <p className="font-bold text-sm text-slate-800">{cart.restaurantName}</p>
              {cart.items.map((i) => (
                <div key={i.key} className="flex justify-between text-sm">
                  <span className="text-slate-600">{i.qty}x {i.name}{i.addons?.length > 0 && <span className="text-xs text-slate-400"> (+{i.addons.map((a) => a.name).join(", ")})</span>}</span>
                  <span className="font-semibold">{fmtBRL(i.unit_price * i.qty)}</span>
                </div>
              ))}
              <div className="border-t pt-2 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmtBRL(subtotal)}</span></div>
                <div className="flex justify-between text-slate-600">
                  <span>{deliveryType === "pickup" ? "Retirada no local" : "Taxa de entrega"}</span>
                  <span>{deliveryFee > 0 ? fmtBRL(deliveryFee) : "Grátis"}</span>
                </div>
                {discount > 0 && <div className="flex justify-between text-emerald-600 font-semibold"><span>Cupom {couponCode}</span><span>-{fmtBRL(discount)}</span></div>}
                <div className="flex justify-between font-display font-extrabold text-lg text-slate-900 pt-1">
                  <span>Total</span><span data-testid="checkout-total">{fmtBRL(total)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border p-4 text-sm space-y-1">
              <p className="font-bold text-slate-800">{deliveryType === "pickup" ? "Retirada no local" : "Entrega em"}</p>
              {deliveryType === "pickup" ? (
                <p className="text-slate-600">{restaurant?.address?.street}, {restaurant?.address?.number} — {restaurant?.address?.district}</p>
              ) : (
                <p className="text-slate-600">{selectedAddress?.street}, {selectedAddress?.number} — {selectedAddress?.district}, {selectedAddress?.city}</p>
              )}
              <p className="text-slate-600">Pagamento: <b>{PAYMENTS.find((p) => p.id === payment)?.label}</b></p>
            </div>
            <Button data-testid="confirm-order-button" disabled={loading} onClick={confirm} className="w-full h-14 rounded-2xl font-bold text-base">
              {loading ? "Enviando pedido..." : `Confirmar pedido • ${fmtBRL(total)}`}
            </Button>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
