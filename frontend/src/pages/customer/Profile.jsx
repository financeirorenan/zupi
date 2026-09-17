import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapPin, Plus, Trash2, User, LifeBuoy, LogOut, Pencil, ChevronDown, Send } from "lucide-react";
import CustomerLayout from "@/components/CustomerLayout";
import PushToggle from "@/components/PushToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { api, apiError, fmtDateTime } from "@/lib/api";
import { toast } from "sonner";

const EMPTY_ADDR = { label: "Casa", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "SP", reference: "" };

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("aba") || "dados";
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [addresses, setAddresses] = useState([]);
  const [addrForm, setAddrForm] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticket, setTicket] = useState({ subject: "", category: "pedido", message: "" });

  useEffect(() => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
  }, [user]);

  const loadAddresses = () => api.get("/addresses").then((r) => setAddresses(r.data)).catch(() => {});
  const loadTickets = () => api.get("/support/mine").then((r) => setTickets(r.data)).catch(() => {});
  const [activeTicket, setActiveTicket] = useState(params.get("chamado") || null);
  const [reply, setReply] = useState("");
  const sendReply = async (t) => {
    if (reply.trim().length < 1) return;
    try {
      await api.post(`/support/${t.id}/messages`, { message: reply.trim() });
      setReply("");
      toast.success("Mensagem enviada ao suporte");
      loadTickets();
    } catch (e) { toast.error(apiError(e)); }
  };

  useEffect(() => {
    if (tab === "enderecos") loadAddresses();
    if (tab === "suporte") loadTickets();
  }, [tab]);

  const saveProfile = async () => {
    try {
      await api.put("/auth/profile", { name, phone });
      await refresh();
      toast.success("Perfil atualizado");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const saveAddress = async () => {
    try {
      if (addrForm.id) await api.put(`/addresses/${addrForm.id}`, addrForm);
      else await api.post("/addresses", addrForm);
      setAddrForm(null);
      loadAddresses();
      toast.success("Endereço salvo");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const sendTicket = async () => {
    try {
      await api.post("/support", ticket);
      setTicket({ subject: "", category: "pedido", message: "" });
      loadTickets();
      toast.success("Ticket enviado ao suporte");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const TABS = [
    { id: "dados", label: "Meus dados", icon: User },
    { id: "enderecos", label: "Endereços", icon: MapPin },
    { id: "suporte", label: "Suporte", icon: LifeBuoy },
  ];

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-6">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-display font-extrabold text-2xl">
            {user?.name?.[0]?.toUpperCase()}
          </span>
          <div>
            <h1 className="font-display font-extrabold text-xl text-slate-900" data-testid="profile-name">{user?.name}</h1>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="flex gap-2 mt-6 border-b pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`profile-tab-${t.id}`}
              onClick={() => setParams({ aba: t.id })}
              className={`flex items-center gap-2 px-4 h-11 text-sm font-bold rounded-t-xl ${tab === t.id ? "text-orange-600 border-b-2 border-orange-600" : "text-slate-500"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "dados" && (
          <div className="mt-5"><PushToggle /></div>
        )}
        {tab === "dados" && (
          <div className="bg-white rounded-2xl border p-5 mt-5 space-y-4" data-testid="profile-data-form">
            <div>
              <label className="text-sm font-semibold text-slate-700">Nome</label>
              <Input data-testid="profile-name-input" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-12 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Telefone / WhatsApp</label>
              <Input data-testid="profile-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-12 rounded-xl" />
            </div>
            <Button data-testid="profile-save-button" onClick={saveProfile} className="h-12 rounded-xl font-bold">Salvar</Button>
            <div className="border-t pt-4">
              <Button
                variant="outline"
                data-testid="profile-logout-button"
                onClick={async () => { await logout(); navigate("/app"); }}
                className="h-12 rounded-xl font-bold text-red-600 border-red-200"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair da conta
              </Button>
              <p className="text-[11px] text-slate-400 mt-3">Seus dados são tratados conforme a LGPD. Para excluir sua conta, abra um ticket no suporte.</p>
            </div>
          </div>
        )}

        {tab === "enderecos" && (
          <div className="mt-5 space-y-3" data-testid="addresses-list">
            {addresses.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border p-4 flex items-center gap-3" data-testid={`address-${a.label.toLowerCase()}`}>
                <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800">{a.label}</p>
                  <p className="text-xs text-slate-500 truncate">{a.street}, {a.number} — {a.district}, {a.city}/{a.state}</p>
                </div>
                <button onClick={() => setAddrForm(a)} className="text-slate-400 hover:text-orange-600" data-testid="address-edit"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => api.delete(`/addresses/${a.id}`).then(loadAddresses)} className="text-slate-400 hover:text-red-500" data-testid="address-delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <Button data-testid="add-address-button" onClick={() => setAddrForm(EMPTY_ADDR)} variant="outline" className="w-full h-12 rounded-xl font-bold border-dashed">
              <Plus className="w-4 h-4 mr-2" /> Adicionar endereço
            </Button>
          </div>
        )}

        {tab === "suporte" && (
          <div className="mt-5 space-y-4" data-testid="support-section">
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <p className="font-bold text-sm text-slate-800">Abrir ticket</p>
              <Input data-testid="ticket-subject" placeholder="Assunto" value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} className="h-12 rounded-xl" />
              <select
                data-testid="ticket-category"
                value={ticket.category}
                onChange={(e) => setTicket({ ...ticket, category: e.target.value })}
                className="w-full h-12 rounded-xl border px-3 text-sm bg-white"
              >
                <option value="pedido">Problema com pedido</option>
                <option value="pagamento">Pagamento</option>
                <option value="entrega">Entrega</option>
                <option value="cancelamento">Cancelamento / Reembolso</option>
                <option value="conta">Minha conta</option>
              </select>
              <Textarea data-testid="ticket-message" placeholder="Descreva o que aconteceu..." value={ticket.message} onChange={(e) => setTicket({ ...ticket, message: e.target.value })} rows={3} className="rounded-xl" />
              <Button data-testid="ticket-submit" onClick={sendTicket} disabled={ticket.subject.length < 3 || ticket.message.length < 3} className="h-12 rounded-xl font-bold">Enviar</Button>
            </div>
            {tickets.map((t) => {
              const openT = activeTicket === t.id;
              const last = t.messages[t.messages.length - 1];
              return (
              <div key={t.id} className="bg-white rounded-2xl border" data-testid={`ticket-${t.id.slice(0, 8)}`}>
                <button data-testid={`ticket-open-${t.id.slice(0, 8)}`} onClick={() => setActiveTicket(openT ? null : t.id)} className="w-full text-left p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-500 truncate">{last?.from_role === "admin" ? "Suporte Zupi: " : ""}{last?.text}</p>
                  </div>
                  {last?.from_role === "admin" && !openT && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" data-testid={`ticket-unread-${t.id.slice(0, 8)}`} />}
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${t.status === "open" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {t.status === "open" ? "Aberto" : "Resolvido"}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openT ? "rotate-180" : ""}`} />
                </button>
                {openT && (
                  <div className="px-4 pb-4 space-y-3" data-testid={`ticket-thread-${t.id.slice(0, 8)}`}>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {t.messages.map((m, i) => (
                        <div key={i} className={`flex ${m.from_role === "admin" ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from_role === "admin" ? "bg-slate-100 text-slate-800" : "bg-orange-600 text-white"}`}>
                            <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.from_role === "admin" ? "Suporte Zupi" : "Você"} • {fmtDateTime(m.at)}</p>
                            <p>{m.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input data-testid={`ticket-reply-input-${t.id.slice(0, 8)}`} placeholder={t.status === "open" ? "Responder ao suporte..." : "Reabrir chamado com uma nova mensagem..."} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply(t)} className="h-11 rounded-xl flex-1" />
                      <Button data-testid={`ticket-reply-send-${t.id.slice(0, 8)}`} onClick={() => sendReply(t)} disabled={reply.trim().length < 1} className="h-11 rounded-xl font-bold"><Send className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!addrForm} onOpenChange={(v) => !v && setAddrForm(null)}>
        <DialogContent className="max-w-md rounded-2xl" data-testid="address-form-modal">
          <DialogHeader><DialogTitle className="font-display">{addrForm?.id ? "Editar endereço" : "Novo endereço"}</DialogTitle></DialogHeader>
          {addrForm && (
            <div className="grid grid-cols-2 gap-2">
              <select value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} className="h-11 rounded-xl border px-3 text-sm bg-white col-span-2" data-testid="addr-label">
                <option>Casa</option><option>Trabalho</option><option>Outro</option>
              </select>
              <Input placeholder="Rua *" value={addrForm.street} onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })} className="col-span-2 h-11 rounded-xl" data-testid="addr-form-street" />
              <Input placeholder="Número" value={addrForm.number} onChange={(e) => setAddrForm({ ...addrForm, number: e.target.value })} className="h-11 rounded-xl" data-testid="addr-form-number" />
              <Input placeholder="Bairro *" value={addrForm.district} onChange={(e) => setAddrForm({ ...addrForm, district: e.target.value })} className="h-11 rounded-xl" data-testid="addr-form-district" />
              <Input placeholder="Cidade *" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} className="h-11 rounded-xl" data-testid="addr-form-city" />
              <Input placeholder="CEP" value={addrForm.cep} onChange={(e) => setAddrForm({ ...addrForm, cep: e.target.value })} className="h-11 rounded-xl" data-testid="addr-form-cep" />
              <Input placeholder="Complemento" value={addrForm.complement} onChange={(e) => setAddrForm({ ...addrForm, complement: e.target.value })} className="col-span-2 h-11 rounded-xl" />
              <Input placeholder="Referência" value={addrForm.reference} onChange={(e) => setAddrForm({ ...addrForm, reference: e.target.value })} className="col-span-2 h-11 rounded-xl" />
              <Button data-testid="addr-save-button" onClick={saveAddress} disabled={!addrForm.street || !addrForm.district || !addrForm.city} className="col-span-2 h-12 rounded-xl font-bold">Salvar endereço</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}
