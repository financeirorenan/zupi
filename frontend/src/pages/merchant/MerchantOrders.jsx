import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { api, fmtBRL, fmtDateTime, apiError } from "@/lib/api";
import { toast } from "sonner";
import { BellRing, Check, X, ChefHat, Package, Bike, PackageCheck } from "lucide-react";

const COLUMNS = [
  { id: "PENDING", label: "Novos", color: "border-amber-400 bg-amber-50" },
  { id: "ACCEPTED", label: "Aceitos", color: "border-blue-400 bg-blue-50" },
  { id: "PREPARING", label: "Em preparo", color: "border-orange-400 bg-orange-50" },
  { id: "READY", label: "Prontos", color: "border-emerald-400 bg-emerald-50" },
  { id: "OUT_FOR_DELIVERY", label: "Em entrega", color: "border-violet-400 bg-violet-50" },
  { id: "DONE", label: "Concluídos", color: "border-slate-300 bg-slate-50" },
];

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1174, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.14);
    });
  } catch {}
}

const elapsed = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const elapsedColor = (m) => (m > 25 ? "text-red-600" : m > 10 ? "text-amber-600" : "text-emerald-600");

const PAYMENT_LABELS = { pix: "Pix", card_machine: "Cartão", cash: "Dinheiro", online: "Online" };

export default function MerchantOrders() {
  const [orders, setOrders] = useState([]);
  const prevPending = useRef(null);

  const load = (silent = true) =>
    api.get("/merchant/orders").then((r) => {
      const pending = r.data.filter((o) => o.status === "PENDING").length;
      if (prevPending.current !== null && pending > prevPending.current) {
        beep();
        toast.success("Novo pedido recebido!", { icon: <BellRing className="w-4 h-4" /> });
      }
      prevPending.current = pending;
      setOrders(r.data);
    }).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const act = async (order, status) => {
    try {
      await api.post(`/merchant/orders/${order.id}/status`, { status });
      toast.success(`Pedido ${order.code} atualizado`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const colOrders = (colId) => {
    if (colId === "DONE") return orders.filter((o) => ["DELIVERED", "CANCELLED"].includes(o.status)).slice(0, 12);
    return orders.filter((o) => o.status === colId);
  };

  const Actions = ({ o }) => (
    <div className="flex gap-1.5 mt-3 flex-wrap">
      {o.status === "PENDING" && (
        <>
          <button data-testid={`accept-${o.code.replace("#", "")}`} onClick={() => act(o, "ACCEPTED")} className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-600">
            <Check className="w-4 h-4" /> Aceitar
          </button>
          <button data-testid={`reject-${o.code.replace("#", "")}`} onClick={() => act(o, "CANCELLED")} className="h-10 px-3 rounded-xl bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center hover:bg-red-200">
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      {o.status === "ACCEPTED" && (
        <button data-testid={`prepare-${o.code.replace("#", "")}`} onClick={() => act(o, "PREPARING")} className="flex-1 h-10 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-orange-700">
          <ChefHat className="w-4 h-4" /> Iniciar preparo
        </button>
      )}
      {o.status === "PREPARING" && (
        <button data-testid={`ready-${o.code.replace("#", "")}`} onClick={() => act(o, "READY")} className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-600">
          <Package className="w-4 h-4" /> Pronto
        </button>
      )}
      {o.status === "READY" && o.delivery_type === "delivery" && (
        <button data-testid={`dispatch-${o.code.replace("#", "")}`} onClick={() => act(o, "OUT_FOR_DELIVERY")} className="flex-1 h-10 rounded-xl bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-violet-600">
          <Bike className="w-4 h-4" /> Saiu p/ entrega
        </button>
      )}
      {o.status === "READY" && o.delivery_type === "pickup" && (
        <button data-testid={`deliver-pickup-${o.code.replace("#", "")}`} onClick={() => act(o, "DELIVERED")} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1">
          <PackageCheck className="w-4 h-4" /> Entregar (retirada)
        </button>
      )}
      {o.status === "OUT_FOR_DELIVERY" && (
        <button data-testid={`deliver-${o.code.replace("#", "")}`} onClick={() => act(o, "DELIVERED")} className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1">
          <PackageCheck className="w-4 h-4" /> Entregue
        </button>
      )}
    </div>
  );

  return (
    <DashboardLayout menu={MERCHANT_MENU} title="Central de Pedidos" subtitle="Atualização automática a cada 5 segundos">
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1" data-testid="orders-kanban">
        {COLUMNS.map((col) => {
          const list = colOrders(col.id);
          return (
            <div key={col.id} className={`shrink-0 w-72 rounded-2xl border-t-4 ${col.color} border-x border-b flex flex-col max-h-[calc(100vh-140px)]`} data-testid={`kanban-col-${col.id.toLowerCase()}`}>
              <div className="p-3 flex items-center justify-between">
                <p className="font-display font-bold text-sm text-slate-800">{col.label}</p>
                <span className="bg-white text-slate-700 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border">{list.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
                {list.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Nenhum pedido</p>}
                {list.map((o) => (
                  <div key={o.id} className="bg-white rounded-xl border shadow-sm p-3" data-testid={`order-ticket-${o.code.replace("#", "")}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-display font-extrabold text-slate-900">{o.code}</p>
                      <span className={`text-[11px] font-bold ${elapsedColor(elapsed(o.created_at))}`}>{elapsed(o.created_at)} min</span>
                    </div>
                    <p className="text-xs text-slate-500">{o.customer_name} • {PAYMENT_LABELS[o.payment_method]} • {o.delivery_type === "pickup" ? "Retirada" : "Entrega"}</p>
                    <div className="mt-2 space-y-0.5">
                      {o.items.map((i, idx) => (
                        <p key={idx} className="text-xs text-slate-700">
                          <b>{i.qty}x</b> {i.name}
                          {i.addons?.length > 0 && <span className="text-slate-400"> +{i.addons.map((a) => a.name).join(", ")}</span>}
                        </p>
                      ))}
                    </div>
                    {o.items.some((i) => i.notes) && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2 italic">
                        {o.items.filter((i) => i.notes).map((i) => i.notes).join(" • ")}
                      </p>
                    )}
                    {o.address && <p className="text-[11px] text-slate-400 mt-1.5 truncate">{o.address.street}, {o.address.number} — {o.address.district}</p>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="font-display font-extrabold text-orange-600">{fmtBRL(o.total)}</span>
                      <span className="text-[10px] text-slate-400">{fmtDateTime(o.created_at)}</span>
                    </div>
                    <Actions o={o} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
