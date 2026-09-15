import { fmtBRL } from "@/lib/api";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const d = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
const dt = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS = { open: "EM ABERTO", overdue: "VENCIDA", paid: "PAGA" };

export function invoiceHtml(inv) {
  const endInc = new Date(inv.period_end + "T12:00:00"); endInc.setDate(endInc.getDate() - 1);
  const rows = (inv.transactions || []).map((t) => `<tr><td>${dt(t.created_at)}</td><td>${esc(t.description)}</td><td class="r ${t.amount < 0 ? "neg" : ""}">${fmtBRL(t.amount)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Fatura ${esc(inv.number)}</title>
<style>
@page{margin:14mm;size:A4}
body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;max-width:190mm;margin:0 auto}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF5722;padding-bottom:10px}
.logo{font-size:26px;font-weight:900;color:#FF5722}.logo small{display:block;font-size:10px;letter-spacing:3px;color:#555}
h1{font-size:18px;margin:0}.muted{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
.box{border:1px solid #ddd;border-radius:8px;padding:12px}.box h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#888}
table{width:100%;border-collapse:collapse;margin-top:10px}th{text-align:left;font-size:11px;color:#888;border-bottom:1px solid #ddd;padding:6px 4px}td{padding:5px 4px;border-bottom:1px solid #f0f0f0}
.r{text-align:right}.neg{color:#c00}.total{font-size:20px;font-weight:900}.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-weight:700;font-size:11px;background:${inv.status === "paid" ? "#dcfce7;color:#15803d" : inv.status === "overdue" ? "#fee2e2;color:#b91c1c" : "#fef3c7;color:#b45309"}}
.pix{background:#fff7ed;border:1px dashed #FF5722;border-radius:8px;padding:12px;margin-top:16px}.foot{margin-top:24px;font-size:10px;color:#888;text-align:center}
</style></head><body>
<div class="head">
  <div class="logo">⚡ Zupi<small>DELIVERY</small></div>
  <div style="text-align:right"><h1>Fatura ${esc(inv.number)}</h1><div class="muted">Emitida em ${dt(inv.created_at)}</div><div style="margin-top:6px"><span class="badge">${STATUS[inv.status] || inv.status}</span></div></div>
</div>
<div class="grid">
  <div class="box"><h3>Cobrado de</h3><b>${esc(inv.restaurant_name)}</b><div class="muted">Restaurante parceiro Zupi</div></div>
  <div class="box"><h3>Período de apuração</h3><b>${d(inv.period_start)} a ${endInc.toLocaleDateString("pt-BR")}</b><div class="muted">Vencimento: <b>${d(inv.due_date)}</b></div></div>
</div>
<div class="box">
  <h3>Resumo</h3>
  <table>
    <tr><td>Pedidos realizados pela plataforma</td><td class="r">${inv.orders}</td></tr>
    <tr><td>Taxa por pedido</td><td class="r">${fmtBRL(inv.orders ? inv.gross_fees / inv.orders : 0)}</td></tr>
    <tr><td>Subtotal de taxas</td><td class="r">${fmtBRL(inv.gross_fees)}</td></tr>
    ${inv.reversals ? `<tr><td>Estornos por cancelamento (${inv.cancelled})</td><td class="r neg">- ${fmtBRL(inv.reversals)}</td></tr>` : ""}
    <tr><td class="total">TOTAL A PAGAR</td><td class="r total" style="color:#FF5722">${fmtBRL(inv.amount)}</td></tr>
  </table>
</div>
${inv.pix_key ? `<div class="pix"><b>Pagamento via Pix</b><br/>Chave: <b>${esc(inv.pix_key)}</b>${inv.pix_name ? ` — Favorecido: ${esc(inv.pix_name)}` : ""}<br/><span class="muted">Informe o número da fatura ${esc(inv.number)} na descrição do Pix.</span></div>` : ""}
${rows ? `<h3 style="margin-top:20px;font-size:12px;color:#888">DETALHAMENTO (${(inv.transactions || []).length} lançamentos)</h3><table><thead><tr><th>Data</th><th>Descrição</th><th class="r">Valor</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
${inv.status === "paid" && inv.paid_at ? `<p class="muted">Pagamento confirmado em ${dt(inv.paid_at)}${inv.payment_note ? ` — ${esc(inv.payment_note)}` : ""}</p>` : ""}
<div class="foot">Zupi Delivery • O delivery da sua cidade • www.zupidelivery.com.br</div>
</body></html>`;
}

export function printInvoice(inv) {
  const frame = document.createElement("iframe");
  frame.setAttribute("data-testid", "print-frame");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(invoiceHtml(inv)); doc.close();
  const done = () => setTimeout(() => frame.remove(), 2000);
  frame.contentWindow.onafterprint = done;
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { done(); } }, 150);
}
