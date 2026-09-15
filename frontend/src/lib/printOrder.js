import { fmtBRL } from "@/lib/api";

const PAY = { pix: "Pix", card_machine: "Cartão (maquininha)", cash: "Dinheiro", online: "Pago online" };
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export function receiptHtml(o, restaurantName = "") {
  const dt = new Date(o.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const items = o.items.map((i) => `
    <tr><td class="q">${i.qty}x</td><td>${esc(i.name)}${i.addons?.length ? `<div class="sub">+ ${esc(i.addons.map((a) => a.name).join(", "))}</div>` : ""}${i.notes ? `<div class="sub obs">OBS: ${esc(i.notes)}</div>` : ""}</td><td class="r">${fmtBRL((i.unit_price || 0) * i.qty)}</td></tr>`).join("");
  const addr = o.address ? `${esc(o.address.street)}, ${esc(o.address.number)}${o.address.complement ? " - " + esc(o.address.complement) : ""}<br/>${esc(o.address.district)}${o.address.reference ? "<br/>Ref: " + esc(o.address.reference) : ""}` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pedido ${esc(o.code)}</title>
<style>
@page{margin:4mm;size:80mm auto}
body{font-family:'Courier New',monospace;font-size:12px;width:72mm;margin:0;color:#000}
h1{font-size:18px;margin:0;text-align:center}h2{font-size:14px;margin:4px 0;text-align:center}
.c{text-align:center}.r{text-align:right}.q{width:26px;font-weight:bold;vertical-align:top}
table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
hr{border:0;border-top:1px dashed #000;margin:6px 0}.sub{font-size:11px;color:#333}.obs{font-weight:bold}
.big{font-size:16px;font-weight:bold}.box{border:2px solid #000;padding:4px;text-align:center;font-weight:bold;margin:6px 0}
</style></head><body>
<h1>${esc(restaurantName || "Zupi Delivery")}</h1>
<div class="c">via Zupi Delivery</div>
<hr/>
<h2>PEDIDO ${esc(o.code)}</h2>
<div class="c">${dt}</div>
<div class="box">${o.delivery_type === "pickup" ? "RETIRADA NO BALCÃO" : "ENTREGA"}</div>
<div><b>Cliente:</b> ${esc(o.customer_name)}</div>
${o.customer_phone ? `<div><b>Tel:</b> ${esc(o.customer_phone)}</div>` : ""}
${addr ? `<div><b>Endereço:</b><br/>${addr}</div>` : ""}
${o.pickup_code ? `<div><b>Código retirada:</b> ${esc(o.pickup_code)}</div>` : ""}
<hr/>
<table>${items}</table>
<hr/>
<table>
<tr><td>Subtotal</td><td class="r">${fmtBRL(o.subtotal)}</td></tr>
${o.discount ? `<tr><td>Desconto${o.coupon_code ? " (" + esc(o.coupon_code) + ")" : ""}</td><td class="r">-${fmtBRL(o.discount)}</td></tr>` : ""}
${o.delivery_fee ? `<tr><td>Entrega</td><td class="r">${fmtBRL(o.delivery_fee)}</td></tr>` : ""}
<tr><td class="big">TOTAL</td><td class="r big">${fmtBRL(o.total)}</td></tr>
</table>
<hr/>
<div><b>Pagamento:</b> ${PAY[o.payment_method] || esc(o.payment_method)}</div>
${o.payment_method === "cash" && o.change_for ? `<div><b>Troco para:</b> ${fmtBRL(o.change_for)} (levar ${fmtBRL(o.change_for - o.total)})</div>` : ""}
${o.courier_name ? `<div><b>Motoboy:</b> ${esc(o.courier_name)}</div>` : ""}
${o.notes ? `<hr/><div class="obs">OBS: ${esc(o.notes)}</div>` : ""}
<hr/>
<div class="c">Obrigado pela preferência!</div>
</body></html>`;
}

export function kitchenHtml(o, restaurantName = "") {
  const dt = new Date(o.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const items = o.items.map((i) => `
    <div class="it"><span class="q">${i.qty}x</span> <span class="n">${esc(i.name)}</span>
    ${i.addons?.length ? `<div class="sub">+ ${esc(i.addons.map((a) => a.name).join(", "))}</div>` : ""}
    ${i.notes ? `<div class="obs">OBS: ${esc(i.notes)}</div>` : ""}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cozinha ${esc(o.code)}</title>
<style>
@page{margin:4mm;size:80mm auto}
body{font-family:'Courier New',monospace;width:72mm;margin:0;color:#000}
h1{font-size:26px;margin:0;text-align:center}.c{text-align:center;font-size:12px}
hr{border:0;border-top:2px dashed #000;margin:6px 0}
.it{font-size:17px;margin:6px 0}.q{font-weight:bold;font-size:20px}.n{font-weight:bold}
.sub{font-size:14px;margin-left:30px}.obs{font-size:15px;font-weight:bold;margin-left:30px;border:2px solid #000;padding:2px 4px;display:inline-block;margin-top:2px}
.box{border:3px solid #000;padding:4px;text-align:center;font-weight:bold;font-size:16px;margin:6px 0}
</style></head><body>
<div class="c">COZINHA — ${esc(restaurantName || "Zupi")}</div>
<h1>${esc(o.code)}</h1>
<div class="c">${dt} • ${esc(o.customer_name)}</div>
<div class="box">${o.delivery_type === "pickup" ? "RETIRADA" : "ENTREGA"}</div>
<hr/>${items}<hr/>
${o.notes ? `<div class="obs">OBS GERAL: ${esc(o.notes)}</div><hr/>` : ""}
<div class="c">${o.items.reduce((s, i) => s + i.qty, 0)} itens</div>
</body></html>`;
}

function printHtml(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("data-testid", "print-frame");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const done = () => setTimeout(() => frame.remove(), 2000);
  frame.contentWindow.onafterprint = done;
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { done(); } }, 150);
}

export function printOrder(o, restaurantName) {
  printHtml(receiptHtml(o, restaurantName));
}

export function printKitchen(o, restaurantName) {
  printHtml(kitchenHtml(o, restaurantName));
}
