import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api/v1`;

const ENDPOINTS = [
  ["GET", "/restaurant", "Dados do restaurante, taxa e zonas de entrega."],
  ["POST", "/restaurant/pause", 'Pausar/reativar pedidos. Body: {"paused": true}'],
  ["GET", "/orders?status=PENDING&since=ISO8601&limit=50", "Lista pedidos (mais recentes primeiro)."],
  ["GET", "/orders/{id}", "Detalhe de um pedido."],
  ["POST", "/orders/{id}/status", 'Atualiza status. Body: {"status": "ACCEPTED", "prep_time": 40}'],
  ["GET", "/menu", "Categorias e produtos do cardápio."],
  ["PATCH", "/menu/products/{id}", 'Atualiza preço/disponibilidade. Body: {"price": 29.9, "available": false, "external_id": "PDV-123"}'],
];

const STATUSES = ["PENDING → ACCEPTED | CANCELLED", "ACCEPTED → PREPARING | CANCELLED", "PREPARING → READY", "READY → OUT_FOR_DELIVERY (entrega) | DELIVERED (retirada)", "OUT_FOR_DELIVERY → DELIVERED"];

const Code = ({ children }) => <pre className="bg-[#1f1f1f] text-orange-100 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{children}</pre>;

export default function DevDocs() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900" data-testid="dev-docs-page">
      <header className="bg-[#121212] text-white">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center gap-4">
          <Link to="/"><Logo light /></Link>
          <span className="text-xs font-bold tracking-[0.2em] text-orange-400">API ABERTA</span>
          <div className="flex-1" />
          <Link to="/lojista/integracoes" className="text-sm font-semibold text-slate-300 hover:text-white">Minhas integrações</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-10 space-y-10">
        <section>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl">Integre seu PDV à Zupi</h1>
          <p className="text-slate-600 mt-3">A API Aberta Zupi permite que Saipos, TakeEat, Consumer ou qualquer sistema receba pedidos em tempo real via <b>webhook</b> e atualize status e cardápio via <b>REST</b>. Toda chamada usa a chave do restaurante no header <code className="bg-slate-200 px-1 rounded">X-API-Key</code>, gerada em <Link to="/lojista/integracoes" className="text-orange-600 font-bold">Painel do lojista → Integrações</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-bold text-base md:text-lg">Base URL e autenticação</h2>
          <Code>{`${BASE}\n\ncurl ${BASE}/orders?status=PENDING \\\n  -H "X-API-Key: zupi_SUA_CHAVE"`}</Code>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-bold text-base md:text-lg">Endpoints</h2>
          <div className="bg-white rounded-2xl border divide-y">
            {ENDPOINTS.map(([m, p, d]) => (
              <div key={p} className="p-4 flex flex-wrap gap-3 items-start" data-testid="dev-endpoint">
                <span className={`text-[11px] font-extrabold px-2 py-1 rounded ${m === "GET" ? "bg-emerald-100 text-emerald-700" : m === "PATCH" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{m}</span>
                <code className="text-sm font-bold">{p}</code>
                <p className="text-sm text-slate-500 basis-full">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-bold text-base md:text-lg">Webhook de pedidos</h2>
          <p className="text-sm text-slate-600">Cadastre a URL do seu sistema. A Zupi envia um <code>POST</code> JSON nos eventos <code>order.created</code>, <code>order.status_changed</code> e <code>order.test</code>. Headers: <code>X-Zupi-Event</code>, <code>X-Zupi-Signature</code> (HMAC-SHA256 hex do corpo com o seu secret) e, para conectores, <code>Authorization: Bearer TOKEN</code>. Responda 2xx em até 10s.</p>
          <Code>{`{
  "event": "order.created",
  "sent_at": "2026-06-01T18:32:10+00:00",
  "order": {
    "id": "uuid", "code": "#1042", "status": "PENDING", "status_label": "Pedido recebido",
    "created_at": "...", "delivery_type": "delivery", "payment_method": "pix", "change_for": null,
    "customer": { "name": "Ana Oliveira", "phone": "16 99999-0000" },
    "address": { "street": "Rua das Flores", "number": "123", "district": "Centro", "city": "Sertãozinho", "reference": "" },
    "items": [{ "product_id": "uuid", "name": "Marmita Parmegiana", "qty": 2, "unit_price": 24.9, "addons": [], "notes": "" }],
    "subtotal": 49.8, "discount": 0, "delivery_fee": 5, "total": 54.8, "coupon_code": null, "courier_name": null
  }
}`}</Code>
          <Code>{`# Validar assinatura (Python)\nimport hmac, hashlib\nok = hmac.compare_digest(request.headers["X-Zupi-Signature"], hmac.new(SECRET.encode(), request.body, hashlib.sha256).hexdigest())`}</Code>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-bold text-base md:text-lg">Fluxo de status</h2>
          <ul className="bg-white rounded-2xl border p-4 text-sm space-y-1 font-mono">{STATUSES.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-bold text-base md:text-lg">Conectores Saipos, TakeEat e Consumer</h2>
          <p className="text-sm text-slate-600">Os conectores usam o mesmo payload de webhook, enviado para a URL do parceiro com o token informado no painel. Assim que a credencial de parceiro for liberada pelo PDV, basta preencher URL e token em Integrações e ativar — sem alterações de código.</p>
        </section>
      </main>
    </div>
  );
}
