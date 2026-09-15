import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { api, fmtBRL, fmtDateTime, apiError } from "@/lib/api";
import { toast } from "sonner";
import { BellRing, Check, X, ChefHat, Package, Bike, PackageCheck, Maximize2, Minimize2, Printer, PrinterCheck } from "lucide-react";
import { printOrder } from "@/lib/printOrder";

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
  const [couriers, setCouriers] = useState([]);
  const [courierPick, setCourierPick] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const [newIds, setNewIds] = useState([]);
  const knownIds = useRef(null);
  const [rest, setRest] = useState(null);
  const autoPrint = rest?.auto_print !== false;
  const autoPrintRef = useRef(true);
  const restNameRef = useRef("");

  const load = () =>
    api.get("/merchant/orders").then((r) => {
      const pendingIds = r.data.filter((o) => o.status === "PENDING").map((o) => o.id);
      if (knownIds.current !== null) {
        const fresh = pendingIds.filter((id) => !knownIds.current.includes(id));
        if (fresh.length) {
          beep();
          toast.success(fresh.length === 1 ? "Novo pedido recebido!" : `${fresh.length} novos pedidos!`, { icon: <BellRing className="w-4 h-4" /> });
          setNewIds((prev) => [...prev, ...fresh]);
          if (autoPrintRef.current) r.data.filter((o) => fresh.includes(o.id)).forEach((o, i) => setTimeout(() => printOrder(o, restNameRef.current), i * 800));
        }
      }
      knownIds.current = pendingIds;
      setOrders(r.data);
    }).catch(() => {});

  useEffect(() => {
    load();
    api.get("/merchant/restaurant").then((r) => { setRest(r.data); autoPrintRef.current = r.data.auto_print !== false; restNameRef.current = r.data.name; }).catch(() => {});
    api.get("/merchant/logistics/couriers").then((r) => setCouriers(r.data.filter((c) => c.active))).catch(() => {});
    const t = setInterval(load, 5000);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => { clearInterval(t); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => setFullscreen(true));
    if (!document.fullscreenEnabled) setFullscreen((f) => !f);
  };

  const act = async (order, status) => {
    try {
      const courier_id = status === "OUT_FOR_DELIVERY" ? courierPick[order.id] || null : null;
      await api.post(`/merchant/orders/${order.id}/status`, { status, courier_id });
      setNewIds((prev) => prev.filter((id) => id !== order.id));
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
        <div className="flex-1 space-y-1.5">
          {couriers.length > 0 && (
            <select data-testid={`courier-select-${o.code.replace("#", "")}`} value={courierPick[o.id] || ""} onChange={(e) => setCourierPick({ ...courierPick, [o.id]: e.target.value })} className="w-full h-10 rounded-xl border px-2 text-xs bg-white">
              <option value="">Escolher motoboy...</option>
              {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button data-testid={`dispatch-${o.code.replace("#", "")}`} onClick={() => act(o, "OUT_FOR_DELIVERY")} className="w-full h-10 rounded-xl bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-violet-600">
            <Bike className="w-4 h-4" /> Saiu p/ entrega
          </button>
        </div>
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

  const toggleAutoPrint = async () => {
    const next = !autoPrint;
    try {
      await api.post("/merchant/auto-print", { auto_print: next });
      setRest({ ...rest, auto_print: next });
      autoPrintRef.current = next;
      toast.success(next ? "Impressão automática ativada" : "Impressão automática desativada (modo KDS)");
    } catch (e) { toast.error(apiError(e)); }
  };

  const fsButton = (
    <div className="flex gap-2">
      <button data-testid="auto-print-toggle" onClick={toggleAutoPrint} title={autoPrint ? "Novos pedidos são impressos automaticamente. Desative se usar KDS." : "Impressão automática desligada (KDS). Toque para ativar."} className={`h-11 px-4 rounded-xl text-xs font-bold flex items-center gap-2 ${autoPrint ? "bg-emerald-500 text-white" : "bg-white border text-slate-600"}`}>
        {autoPrint ? <PrinterCheck className="w-4 h-4" /> : <Printer className="w-4 h-4" />} {autoPrint ? "Impressão automática" : "Sem impressão (KDS)"}
      </button>
      <button data-testid="fullscreen-toggle" onClick={toggleFullscreen} className="h-11 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2 hover:bg-slate-700">
        {fullscreen ? <><Minimize2 className="w-4 h-4" /> Sair da tela cheia</> : <><Maximize2 className="w-4 h-4" /> Tela cheia</>}
      </button>
    </div>
  );

  const board = (
    <div className={`flex gap-3 ${fullscreen ? "h-full" : "overflow-x-auto no-scrollbar pb-4 -mx-1 px-1"}`} data-testid="orders-kanban">
        {COLUMNS.map((col) => {
          const list = colOrders(col.id);
          return (
            <div key={col.id} className={`${fullscreen ? "flex-1 min-w-0" : "shrink-0 w-72 max-h-[calc(100vh-140px)]"} rounded-2xl border-t-4 ${col.color} border-x border-b flex flex-col`} data-testid={`kanban-col-${col.id.toLowerCase()}`}>
              <div className="p-3 flex items-center justify-between">
                <p className="font-display font-bold text-sm text-slate-800">{col.label}</p>
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border ${col.id === "PENDING" && list.length ? "bg-amber-400 text-white border-amber-400 animate-pulse" : "bg-white text-slate-700"}`}>{list.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
                {list.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Nenhum pedido</p>}
                {list.map((o) => {
                  const isNew = newIds.includes(o.id) && o.status === "PENDING";
                  return (
                  <div key={o.id} className={`bg-white rounded-xl border shadow-sm p-3 ${isNew ? "new-order-blink" : ""}`} data-testid={`order-ticket-${o.code.replace("#", "")}`} data-new={isNew ? "true" : undefined}>
                    <div className="flex items-center justify-between">
                      <p className="font-display font-extrabold text-slate-900">{o.code}</p>
                      <div className="flex items-center gap-2">
                        <button data-testid={`print-${o.code.replace("#", "")}`} onClick={() => printOrder(o, restNameRef.current)} title="Imprimir pedido" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"><Printer className="w-4 h-4" /></button>
                        <span className={`text-[11px] font-bold ${elapsedColor(elapsed(o.created_at))}`}>{elapsed(o.created_at)} min</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{o.customer_name} • {PAYMENT_LABELS[o.payment_method]} • {o.delivery_type === "pickup" ? "Retirada" : "Entrega"}{o.courier_name ? ` • ${o.courier_name}` : ""}</p>
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
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#F8F9FA] flex flex-col" data-testid="orders-fullscreen">
        <div className="h-14 px-4 flex items-center gap-3 bg-[#121212] text-white">
          <p className="font-display font-extrabold">Central de Pedidos</p>
          <span className="text-xs text-slate-400">atualiza a cada 5s</span>
          <div className="flex-1" />
          {fsButton}
        </div>
        <div className="flex-1 min-h-0 p-3">{board}</div>
      </div>
    );
  }

  return (
    <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Central de Pedidos" subtitle="Atualização automática a cada 5 segundos" actions={fsButton}>
      {board}
    </DashboardLayout>
  );
}
