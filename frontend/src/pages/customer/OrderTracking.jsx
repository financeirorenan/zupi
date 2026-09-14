import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, QrCode, Store } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import StatusBadge from "@/components/StatusBadge";
import { StarInput } from "@/components/Stars";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, fmtBRL, fmtDateTime, apiError } from "@/lib/api";
import { toast } from "sonner";

const FLOW = [
  { id: "PENDING", label: "Pedido recebido" },
  { id: "ACCEPTED", label: "Restaurante aceitou" },
  { id: "PREPARING", label: "Em preparação" },
  { id: "READY", label: "Pronto" },
  { id: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  { id: "DELIVERED", label: "Entregue" },
];

const PAYMENT_LABELS = { pix: "Pix", card_machine: "Cartão na entrega", cash: "Dinheiro", online: "Pagamento online" };

export default function OrderTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSent, setReviewSent] = useState(false);
  const prevStatus = useRef(null);

  const load = () => api.get(`/orders/${id}`).then((r) => {
    if (prevStatus.current && prevStatus.current !== r.data.status) {
      toast.success(`Status atualizado: ${r.data.status}`);
    }
    prevStatus.current = r.data.status;
    setOrder(r.data);
  }).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  if (!order) return <CustomerLayout><Loading /></CustomerLayout>;

  const isCancelled = order.status === "CANCELLED";
  const currentIdx = isCancelled ? -1 : FLOW.findIndex((f) => f.id === order.status);
  const pixCode = `00020126580014BR.GOV.BCB.PIX0136zupi-pedido-${order.id}520400005303986540${order.total.toFixed(2)}5802BR5913Zupi Delivery6009Sertaozinho62070503***6304`;

  const cancel = async () => {
    try {
      await api.post(`/orders/${order.id}/cancel`);
      toast.success("Pedido cancelado");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const sendReview = async () => {
    try {
      await api.post(`/orders/${order.id}/review`, { rating, food_rating: rating, delivery_rating: rating, comment });
      setReviewSent(true);
      toast.success("Obrigado pela avaliação!");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/pedidos")} className="w-11 h-11 rounded-xl bg-white border flex items-center justify-center" data-testid="tracking-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-xl text-slate-900">Pedido {order.code}</h1>
            <p className="text-sm text-slate-500">{order.restaurant_name}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="bg-white rounded-2xl border p-5 mt-5" data-testid="order-timeline">
          {isCancelled ? (
            <p className="text-center text-red-600 font-bold py-4">Este pedido foi cancelado.</p>
          ) : (
            <div className="space-y-0">
              {FLOW.filter((f) => order.delivery_type === "delivery" || f.id !== "OUT_FOR_DELIVERY").map((f, i, arr) => {
                const idx = FLOW.findIndex((x) => x.id === f.id);
                const done = idx <= currentIdx;
                const hist = order.status_history?.find((h) => h.status === f.id);
                return (
                  <div key={f.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${done ? "bg-orange-600 border-orange-600" : "border-slate-200 bg-white"}`}>
                        {done && <Check className="w-4 h-4 text-white" />}
                      </span>
                      {i < arr.length - 1 && <span className={`w-0.5 h-8 ${idx < currentIdx ? "bg-orange-600" : "bg-slate-200"}`} />}
                    </div>
                    <div className="pb-8">
                      <p className={`font-bold text-sm ${done ? "text-slate-900" : "text-slate-400"}`}>{f.label}</p>
                      {hist && <p className="text-xs text-slate-400">{fmtDateTime(hist.at)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {order.delivery_type === "pickup" && order.pickup_code && !isCancelled && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mt-4 text-center" data-testid="pickup-code-box">
            <Store className="w-6 h-6 text-orange-600 mx-auto" />
            <p className="text-sm text-orange-800 mt-1">Código de retirada</p>
            <p className="font-display font-extrabold text-3xl text-orange-700 tracking-widest">{order.pickup_code}</p>
          </div>
        )}

        {order.payment_method === "pix" && !isCancelled && (
          <div className="bg-white rounded-2xl border p-5 mt-4" data-testid="pix-payment-box">
            <p className="font-bold text-sm text-slate-800 flex items-center gap-2"><QrCode className="w-5 h-5 text-orange-600" /> Pagamento Pix — {fmtBRL(order.total)}</p>
            <p className="text-xs text-slate-500 mt-1">Use o código copia e cola abaixo no app do seu banco:</p>
            <div className="flex gap-2 mt-2">
              <code className="flex-1 text-[10px] bg-slate-50 border rounded-xl p-3 break-all text-slate-600">{pixCode}</code>
              <Button
                variant="outline"
                className="rounded-xl h-auto"
                data-testid="pix-copy-button"
                onClick={() => { navigator.clipboard?.writeText(pixCode); toast.success("Código Pix copiado!"); }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border p-5 mt-4">
          <p className="font-bold text-sm text-slate-800 mb-3">Resumo</p>
          {order.items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm py-1">
              <span className="text-slate-600">{i.qty}x {i.name}{i.addons?.length > 0 && <span className="text-xs text-slate-400"> (+{i.addons.map((a) => a.name).join(", ")})</span>}</span>
              <span className="font-semibold">{fmtBRL(i.line_total)}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmtBRL(order.subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Entrega</span><span>{order.delivery_fee > 0 ? fmtBRL(order.delivery_fee) : "Grátis"}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-emerald-600 font-semibold"><span>Cupom {order.coupon_code}</span><span>-{fmtBRL(order.discount)}</span></div>}
            <div className="flex justify-between font-display font-extrabold text-slate-900 pt-1"><span>Total ({PAYMENT_LABELS[order.payment_method]})</span><span>{fmtBRL(order.total)}</span></div>
          </div>
          {order.address && (
            <p className="text-xs text-slate-400 mt-3">Entregar em: {order.address.street}, {order.address.number} — {order.address.district}, {order.address.city}</p>
          )}
        </div>

        {["PENDING"].includes(order.status) && (
          <Button variant="outline" data-testid="cancel-order-button" onClick={cancel} className="w-full h-12 rounded-xl font-bold text-red-600 border-red-200 mt-4">
            Cancelar pedido
          </Button>
        )}

        {order.status === "DELIVERED" && !order.reviewed && !reviewSent && (
          <div className="bg-white rounded-2xl border p-5 mt-4" data-testid="review-form">
            <p className="font-display font-bold text-slate-900">Como foi seu pedido?</p>
            <div className="mt-2"><StarInput value={rating} onChange={setRating} /></div>
            <Textarea data-testid="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte como foi a comida e a entrega..." className="mt-3 rounded-xl" rows={3} />
            <Button data-testid="review-submit" onClick={sendReview} className="w-full h-12 rounded-xl font-bold mt-3">Enviar avaliação</Button>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          Problema com o pedido? <Link to="/perfil?aba=suporte" className="text-orange-600 font-semibold" data-testid="support-link">Fale com o suporte</Link>
        </p>
      </div>
    </CustomerLayout>
  );
}
