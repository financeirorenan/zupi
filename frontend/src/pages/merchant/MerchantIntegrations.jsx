import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { MERCHANT_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, apiError, fmtDateTime } from "@/lib/api";
import { toast } from "sonner";
import { Copy, RefreshCw, Send, KeyRound, Webhook, BookOpen } from "lucide-react";

const CONNECTORS = [
  { id: "saipos", name: "Saipos", hint: "URL de recebimento de pedidos fornecida pela Saipos + token de parceiro" },
  { id: "takeeat", name: "TakeEat", hint: "Endpoint de integração TakeEat + token da loja" },
  { id: "consumer", name: "Consumer", hint: "URL do Consumer Delivery + chave de integração" },
];

const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success("Copiado"));

function ConnectorCard({ c, cfg, onChange, onTest }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 space-y-3 ${cfg.enabled ? "border-orange-300" : ""}`} data-testid={`connector-${c.id}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-slate-900">{c.name}</h3>
          <p className="text-xs text-slate-500">{c.hint}</p>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => onChange({ ...cfg, enabled: v })} data-testid={`connector-${c.id}-toggle`} />
      </div>
      <Input data-testid={`connector-${c.id}-url`} placeholder="https://..." value={cfg.url} onChange={(e) => onChange({ ...cfg, url: e.target.value })} className="h-11 rounded-xl" />
      <div className="flex gap-2">
        <Input data-testid={`connector-${c.id}-token`} placeholder="Token / chave do parceiro" value={cfg.token} onChange={(e) => onChange({ ...cfg, token: e.target.value })} className="h-11 rounded-xl flex-1" />
        <button data-testid={`connector-${c.id}-test`} onClick={() => onTest(c.id)} disabled={!cfg.url} className="h-11 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"><Send className="w-3.5 h-3.5" /> Testar</button>
      </div>
    </div>
  );
}

export default function MerchantIntegrations() {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadLogs = () => api.get("/merchant/integrations/logs").then((r) => setLogs(r.data)).catch(() => {});
  useEffect(() => {
    api.get("/merchant/integrations").then((r) => setData(r.data)).catch(() => setData(false));
    loadLogs();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { webhook, saipos, takeeat, consumer } = data;
      const r = await api.put("/merchant/integrations", { webhook, saipos, takeeat, consumer });
      setData(r.data); toast.success("Integrações salvas");
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const test = async (connector) => {
    try {
      await save();
      const r = await api.post("/merchant/integrations/test", { connector });
      r.data.ok ? toast.success(`Envio OK (HTTP ${r.data.status_code})`) : toast.error(`Falhou: HTTP ${r.data.status_code || "sem resposta"}`);
      loadLogs();
    } catch (e) { toast.error(apiError(e)); }
  };

  const rotate = async () => {
    if (!window.confirm("Gerar nova chave? A chave atual deixará de funcionar.")) return;
    const r = await api.post("/merchant/integrations/rotate-key");
    setData({ ...data, api_key: r.data.api_key }); setShowKey(true); toast.success("Nova chave gerada");
  };

  if (data === null) return <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Integrações"><Loading /></DashboardLayout>;
  if (data === false) return <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Integrações"><p className="text-sm text-slate-500">Cadastre seu restaurante antes de configurar integrações.</p></DashboardLayout>;

  const baseUrl = `${process.env.REACT_APP_BACKEND_URL}/api/v1`;

  return (
    <DashboardLayout variant="top" menu={MERCHANT_MENU} title="Integrações" subtitle="PDV, API aberta e webhooks"
      actions={<Link to="/dev" target="_blank" data-testid="open-dev-docs" className="h-11 px-4 rounded-xl border bg-white text-xs font-bold flex items-center gap-2"><BookOpen className="w-4 h-4" /> Documentação</Link>}>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-2xl border p-5 space-y-3" data-testid="api-key-section">
          <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-orange-600" /> Chave da API Aberta</h3>
          <p className="text-xs text-slate-500">Use no header <code className="bg-slate-100 px-1 rounded">X-API-Key</code>. Base: <code className="bg-slate-100 px-1 rounded break-all">{baseUrl}</code></p>
          <div className="flex gap-2">
            <Input readOnly data-testid="api-key-value" value={showKey ? data.api_key : "•".repeat(28)} className="h-11 rounded-xl font-mono text-xs" />
            <button data-testid="api-key-show" onClick={() => setShowKey(!showKey)} className="h-11 px-3 rounded-xl border text-xs font-bold">{showKey ? "Ocultar" : "Mostrar"}</button>
            <button data-testid="api-key-copy" onClick={() => copy(data.api_key)} className="h-11 w-11 rounded-xl border flex items-center justify-center"><Copy className="w-4 h-4" /></button>
            <button data-testid="api-key-rotate" onClick={rotate} className="h-11 w-11 rounded-xl border flex items-center justify-center text-red-500"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {data.last_api_call && <p className="text-xs text-slate-400">Última chamada: {fmtDateTime(data.last_api_call)}</p>}
        </section>

        <section className="bg-white rounded-2xl border p-5 space-y-3" data-testid="webhook-section">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-900 flex items-center gap-2"><Webhook className="w-5 h-5 text-orange-600" /> Webhook genérico</h3>
            <Switch checked={data.webhook.enabled} onCheckedChange={(v) => setData({ ...data, webhook: { ...data.webhook, enabled: v } })} data-testid="webhook-toggle" />
          </div>
          <p className="text-xs text-slate-500">Recebe cada pedido novo e mudança de status em JSON assinado (HMAC-SHA256).</p>
          <Input data-testid="webhook-url" placeholder="https://seu-sistema.com/zupi/webhook" value={data.webhook.url} onChange={(e) => setData({ ...data, webhook: { ...data.webhook, url: e.target.value } })} className="h-11 rounded-xl" />
          <div className="flex gap-2">
            <Input data-testid="webhook-secret" value={data.webhook.secret} onChange={(e) => setData({ ...data, webhook: { ...data.webhook, secret: e.target.value } })} className="h-11 rounded-xl font-mono text-xs flex-1" placeholder="Secret de assinatura" />
            <button data-testid="webhook-test" onClick={() => test("webhook")} disabled={!data.webhook.url} className="h-11 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"><Send className="w-3.5 h-3.5" /> Testar</button>
          </div>
        </section>

        {CONNECTORS.map((c) => (
          <ConnectorCard key={c.id} c={c} cfg={data[c.id]} onChange={(cfg) => setData({ ...data, [c.id]: cfg })} onTest={test} />
        ))}

        <section className="bg-white rounded-2xl border p-5 flex flex-col justify-between" data-testid="save-section">
          <p className="text-sm text-slate-500">Saipos, TakeEat e Consumer usam o mesmo payload da API Aberta. Quando o PDV liberar a credencial de parceiro, preencha URL e token e ative o conector.</p>
          <Button data-testid="integrations-save" onClick={save} disabled={saving} className="w-full h-12 rounded-xl font-bold mt-4">{saving ? "Salvando..." : "Salvar integrações"}</Button>
        </section>
      </div>

      <section className="bg-white rounded-2xl border mt-5 overflow-x-auto" data-testid="webhook-logs">
        <h3 className="font-display font-bold text-slate-900 p-5 pb-2">Últimos envios</h3>
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-left text-xs text-slate-400 border-b"><th className="px-5 py-2">Data</th><th className="px-5 py-2">Destino</th><th className="px-5 py-2">Evento</th><th className="px-5 py-2">Pedido</th><th className="px-5 py-2 text-right">Resultado</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-5 py-2.5 text-slate-500">{fmtDateTime(l.created_at)}</td>
                <td className="px-5 py-2.5 font-semibold capitalize">{l.connector}</td>
                <td className="px-5 py-2.5 font-mono text-xs">{l.event}</td>
                <td className="px-5 py-2.5">{l.order_code}</td>
                <td className={`px-5 py-2.5 text-right font-bold ${l.ok ? "text-emerald-600" : "text-red-500"}`}>{l.ok ? "OK" : "Falha"} {l.status_code || ""}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhum envio ainda. Configure uma URL e clique em Testar.</td></tr>}
          </tbody>
        </table>
      </section>
    </DashboardLayout>
  );
}
