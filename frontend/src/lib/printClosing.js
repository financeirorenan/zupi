import { fmtBRL } from "@/lib/api";

const PAY = { pix: "Pix", card_machine: "Cartão (maquininha)", cash: "Dinheiro", online: "Pago online" };
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const row = (l, v, cls = "") => `<tr class="${cls}"><td>${l}</td><td class="r">${v}</td></tr>`;

export function closingHtml(d) {
  const date = new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const gen = new Date(d.generated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Fechamento ${d.date}</title>
<style>
@page{margin:4mm;size:80mm auto}
body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0;color:#000}
h1{font-size:16px;margin:0;text-align:center}h2{font-size:13px;margin:8px 0 2px;text-transform:uppercase}
.c{text-align:center}.r{text-align:right}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
hr{border:0;border-top:1px dashed #000;margin:6px 0}.big td{font-size:15px;font-weight:bold}.sub td{color:#333;font-size:11px}
</style></head><body>
<h1>${esc(d.restaurant)}</h1>
<div class="c">FECHAMENTO DO DIA</div>
<div class="c">${esc(date)}</div>
<div class="c sub">gerado em ${gen} • via Zupi</div>
<hr/>
<h2>Pedidos</h2>
<table>${row("Concluídos/válidos", d.orders)}${row("Cancelados", d.cancelled)}${row("Entregas", d.deliveries)}${row("Retiradas", d.pickups)}${row("Ticket médio", fmtBRL(d.avg_ticket))}</table>
<hr/>
<h2>Vendas</h2>
<table>${row("Produtos (bruto)", fmtBRL(d.gross))}${d.discounts ? row("Descontos/cupons", "-" + fmtBRL(d.discounts)) : ""}${row("Taxas de entrega", fmtBRL(d.delivery_fees))}${row("TOTAL VENDIDO", fmtBRL(d.total), "big")}</table>
<hr/>
<h2>Por forma de pagamento</h2>
<table>${d.by_payment.map((p) => row(`${PAY[p.method] || esc(p.method)} (${p.orders})`, fmtBRL(p.total))).join("") || row("—", "—")}</table>
<hr/>
<h2>Custos</h2>
<table>${row(`Taxa Zupi (${d.orders} x ${fmtBRL(d.platform_fee)})`, "-" + fmtBRL(d.zupi_fees))}
${d.couriers.map((c) => row(`Diária ${esc(c.name)} (${c.deliveries} entr.)`, "-" + fmtBRL(c.daily_rate))).join("")}
${row("Total diárias", "-" + fmtBRL(d.courier_cost))}</table>
<hr/>
<table>${row("RESULTADO DO DIA", fmtBRL(d.net), "big")}</table>
<div class="c sub">vendas - taxa Zupi - diárias</div>
<hr/>
<div class="c">Assinatura: ______________________</div>
</body></html>`;
}

export function printClosing(d) {
  const frame = document.createElement("iframe");
  frame.setAttribute("data-testid", "print-frame");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(closingHtml(d)); doc.close();
  const done = () => setTimeout(() => frame.remove(), 2000);
  frame.contentWindow.onafterprint = done;
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { done(); } }, 150);
}
