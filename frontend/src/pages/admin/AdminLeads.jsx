import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { api, apiError, fmtDateTime } from "@/lib/api";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Store } from "lucide-react";

const STATUS = [
  { id: "new", label: "Novo", cls: "bg-amber-100 text-amber-700" },
  { id: "contacted", label: "Em contato", cls: "bg-blue-100 text-blue-700" },
  { id: "closed", label: "Fechado", cls: "bg-emerald-100 text-emerald-700" },
];

export default function AdminLeads() {
  const [leads, setLeads] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = () => api.get("/admin/leads").then((r) => setLeads(r.data)).catch(() => setLeads([]));
  useEffect(() => { load(); }, []);

  const setStatus = async (lead, status) => {
    try {
      const r = await api.patch(`/admin/leads/${lead.id}`, { status, notes: lead.notes || "" });
      setLeads(leads.map((l) => (l.id === lead.id ? r.data : l)));
      toast.success(`Lead marcado como ${STATUS.find((s) => s.id === status).label.toLowerCase()}`);
    } catch (e) { toast.error(apiError(e)); }
  };

  const saveNotes = async (lead, notes) => {
    if (notes === (lead.notes || "")) return;
    try {
      const r = await api.patch(`/admin/leads/${lead.id}`, { status: lead.status, notes });
      setLeads(leads.map((l) => (l.id === lead.id ? r.data : l)));
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!leads) return <DashboardLayout menu={ADMIN_MENU} title="Leads"><Loading /></DashboardLayout>;

  const counts = Object.fromEntries(STATUS.map((s) => [s.id, leads.filter((l) => l.status === s.id).length]));
  const list = filter === "all" ? leads : leads.filter((l) => l.status === filter);
  const wa = (phone) => `https://wa.me/55${(phone || "").replace(/\D/g, "")}`;

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Leads do site" subtitle="Restaurantes interessados em entrar na Zupi"
      actions={
        <div className="flex gap-1.5 bg-white border rounded-xl p-1" data-testid="leads-filter">
          {[{ id: "all", label: `Todos (${leads.length})` }, ...STATUS.map((s) => ({ id: s.id, label: `${s.label} (${counts[s.id]})` }))].map((f) => (
            <button key={f.id} data-testid={`leads-filter-${f.id}`} onClick={() => setFilter(f.id)} className={`h-9 px-3 rounded-lg text-xs font-bold ${filter === f.id ? "bg-orange-600 text-white" : "text-slate-500"}`}>{f.label}</button>
          ))}
        </div>
      }>
      {list.length === 0 && <p className="text-sm text-slate-400 text-center py-16" data-testid="leads-empty">Nenhum lead {filter !== "all" ? "neste status" : "ainda"}.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((l) => {
          const st = STATUS.find((s) => s.id === l.status) || STATUS[0];
          return (
            <div key={l.id} className="bg-white rounded-2xl border p-5 space-y-3" data-testid={`lead-card-${l.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-extrabold text-slate-900 truncate">{l.name}</p>
                  {l.business && <p className="text-sm text-slate-600 flex items-center gap-1 truncate"><Store className="w-3.5 h-3.5" /> {l.business}</p>}
                </div>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${st.cls}`} data-testid={`lead-status-${l.id}`}>{st.label}</span>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {l.city}</p>
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> <a href={wa(l.phone)} target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold hover:underline" data-testid={`lead-whatsapp-${l.id}`}>{l.phone}</a></p>
                {l.email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> <a href={`mailto:${l.email}`} className="hover:underline">{l.email}</a></p>}
                <p className="text-slate-400">Recebido {fmtDateTime(l.created_at)}</p>
              </div>
              <textarea
                data-testid={`lead-notes-${l.id}`}
                defaultValue={l.notes || ""}
                onBlur={(e) => saveNotes(l, e.target.value)}
                placeholder="Anotações do contato..."
                rows={2}
                className="w-full text-xs rounded-xl border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <div className="flex gap-1.5">
                {STATUS.map((s) => (
                  <button key={s.id} data-testid={`lead-set-${s.id}-${l.id}`} onClick={() => setStatus(l, s.id)} disabled={l.status === s.id}
                    className={`flex-1 h-9 rounded-lg text-xs font-bold transition-colors ${l.status === s.id ? `${s.cls} cursor-default` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
