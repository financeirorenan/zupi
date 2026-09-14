import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import Stars from "@/components/Stars";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, apiError, fmtBRL, fmtDateTime } from "@/lib/api";
import { toast } from "sonner";
import { Settings, LifeBuoy, ScrollText, Star, Trash2 } from "lucide-react";

export default function AdminSystem() {
  const [tab, setTab] = useState("config");
  const [settings, setSettings] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [logs, setLogs] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [reply, setReply] = useState({});

  useEffect(() => {
    api.get("/admin/settings").then((r) => setSettings(r.data)).catch(() => {});
    api.get("/admin/support").then((r) => setTickets(r.data)).catch(() => setTickets([]));
    api.get("/admin/audit").then((r) => setLogs(r.data)).catch(() => setLogs([]));
    api.get("/admin/reviews").then((r) => setReviews(r.data)).catch(() => setReviews([]));
  }, []);

  const saveSettings = async () => {
    try {
      await api.put("/admin/settings", { platform_fee: parseFloat(settings.platform_fee), platform_name: settings.platform_name });
      toast.success("Configurações salvas");
    } catch (e) { toast.error(apiError(e)); }
  };

  const replyTicket = async (t, close) => {
    try {
      await api.post(`/admin/support/${t.id}/reply`, { message: reply[t.id] || "", close });
      setReply({ ...reply, [t.id]: "" });
      const { data } = await api.get("/admin/support");
      setTickets(data);
      toast.success("Resposta enviada");
    } catch (e) { toast.error(apiError(e)); }
  };

  const moderate = async (r) => {
    await api.post(`/admin/reviews/${r.id}/moderate`);
    setReviews(reviews.filter((x) => x.id !== r.id));
    toast.success("Avaliação removida");
  };

  const TABS = [
    { id: "config", label: "Configurações", icon: Settings },
    { id: "suporte", label: "Suporte", icon: LifeBuoy },
    { id: "auditoria", label: "Auditoria", icon: ScrollText },
    { id: "avaliacoes", label: "Avaliações", icon: Star },
  ];

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Sistema" subtitle="Configurações, suporte, auditoria e moderação">
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} data-testid={`system-tab-${t.id}`} onClick={() => setTab(t.id)} className={`h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 ${tab === t.id ? "bg-orange-600 text-white" : "bg-white border text-slate-600"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        !settings ? <Loading /> : (
          <div className="bg-white rounded-2xl border p-5 max-w-md space-y-4" data-testid="settings-form">
            <div>
              <label className="text-sm font-semibold text-slate-700">Nome da plataforma</label>
              <Input data-testid="platform-name-input" value={settings.platform_name} onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })} className="mt-1 h-12 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Taxa Zupi por pedido (R$)</label>
              <Input data-testid="platform-fee-input" type="number" step="0.5" min="0" max="50" value={settings.platform_fee} onChange={(e) => setSettings({ ...settings, platform_fee: e.target.value })} className="mt-1 h-12 rounded-xl" />
              <p className="text-xs text-slate-400 mt-1">Padrão: R$ 2,00. Aplicada a novos pedidos.</p>
            </div>
            <Button data-testid="settings-save-button" onClick={saveSettings} className="h-12 rounded-xl font-bold">Salvar</Button>
          </div>
        )
      )}

      {tab === "suporte" && (
        !tickets ? <Loading /> : (
          <div className="space-y-4 max-w-3xl" data-testid="support-tickets">
            {tickets.length === 0 && <p className="text-sm text-slate-400 bg-white rounded-2xl border p-8 text-center">Nenhum ticket aberto.</p>}
            {tickets.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border p-5" data-testid={`admin-ticket-${t.id.slice(0, 8)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{t.subject}</p>
                    <p className="text-xs text-slate-400">{t.user_name} • {t.category} • {fmtDateTime(t.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${t.status === "open" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{t.status === "open" ? "Aberto" : "Resolvido"}</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {t.messages.map((m, i) => (
                    <p key={i} className="text-xs text-slate-600"><b>{m.from}:</b> {m.text}</p>
                  ))}
                </div>
                {t.status === "open" && (
                  <div className="flex gap-2 mt-3">
                    <Textarea data-testid={`ticket-reply-${t.id.slice(0, 8)}`} placeholder="Responder..." value={reply[t.id] || ""} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} rows={1} className="rounded-xl" />
                    <Button data-testid={`ticket-reply-send-${t.id.slice(0, 8)}`} onClick={() => replyTicket(t, false)} disabled={!reply[t.id]} className="rounded-xl font-bold shrink-0">Responder</Button>
                    <Button variant="outline" data-testid={`ticket-close-${t.id.slice(0, 8)}`} onClick={() => replyTicket(t, true)} className="rounded-xl font-bold shrink-0">Resolver</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "auditoria" && (
        !logs ? <Loading /> : (
          <div className="bg-white rounded-2xl border overflow-x-auto max-w-4xl">
            <table className="w-full text-sm min-w-[560px]" data-testid="audit-table">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b"><th className="p-4">Quando</th><th className="p-4">Ação</th><th className="p-4">Entidade</th><th className="p-4">Detalhes</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="p-4 text-slate-500 whitespace-nowrap">{fmtDateTime(l.at)}</td>
                    <td className="p-4 font-semibold">{l.action}</td>
                    <td className="p-4">{l.entity}</td>
                    <td className="p-4 text-xs text-slate-500 max-w-xs truncate">{JSON.stringify(l.after || l.before || {})}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum registro de auditoria.</td></tr>}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "avaliacoes" && (
        !reviews ? <Loading /> : (
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl" data-testid="admin-reviews">
            {reviews.length === 0 && <p className="text-sm text-slate-400 bg-white rounded-2xl border p-8 text-center col-span-2">Nenhuma avaliação para moderar.</p>}
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border p-5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-slate-800">{r.customer_name}</p>
                  <div className="flex items-center gap-2">
                    <Stars rating={r.rating} />
                    <button data-testid={`moderate-${r.id.slice(0, 8)}`} onClick={() => moderate(r)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {r.comment && <p className="text-sm text-slate-600 mt-2">"{r.comment}"</p>}
                <p className="text-[11px] text-slate-400 mt-2">{fmtDateTime(r.created_at)}</p>
              </div>
            ))}
          </div>
        )
      )}
    </DashboardLayout>
  );
}
