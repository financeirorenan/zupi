const STATUS = {
  PENDING: { label: "Pedido recebido", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  ACCEPTED: { label: "Aceito", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  PREPARING: { label: "Em preparação", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  READY: { label: "Pronto", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  OUT_FOR_DELIVERY: { label: "Saiu para entrega", cls: "bg-violet-100 text-violet-700 border-violet-200" },
  DELIVERED: { label: "Entregue", cls: "bg-emerald-600 text-white border-emerald-600" },
  CANCELLED: { label: "Cancelado", cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span data-testid={`status-badge-${status?.toLowerCase()}`} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${s.cls}`}>
      {s.label}
    </span>
  );
}
