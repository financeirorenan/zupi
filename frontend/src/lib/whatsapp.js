import { fmtBRL } from "@/lib/api";

const MSG = {
  PENDING: (o, r) => `Olá ${first(o)}! Aqui é do *${r}* via Zupi. Recebemos seu pedido *${o.code}* (${fmtBRL(o.total)}) e já vamos confirmar. 😊`,
  ACCEPTED: (o, r) => `Olá ${first(o)}! Seu pedido *${o.code}* foi aceito pelo *${r}*. Tempo estimado: ${o.prep_time || 40} min.`,
  PREPARING: (o, r) => `${first(o)}, seu pedido *${o.code}* já está em preparo no *${r}*! 👨‍🍳`,
  READY: (o, r) => o.delivery_type === "pickup"
    ? `${first(o)}, seu pedido *${o.code}* está pronto para retirada no *${r}*! Código: *${o.pickup_code || o.code}*.`
    : `${first(o)}, seu pedido *${o.code}* está pronto e sai para entrega em instantes. 🛵`,
  OUT_FOR_DELIVERY: (o, r) => `${first(o)}, seu pedido *${o.code}* saiu para entrega${o.courier_name ? ` com o ${o.courier_name}` : ""}! Chega em breve. 🛵`,
  DELIVERED: (o, r) => `${first(o)}, pedido *${o.code}* entregue! Obrigado por pedir no *${r}* pela Zupi. Avalie seu pedido no app 💛`,
  CANCELLED: (o, r) => `${first(o)}, infelizmente o pedido *${o.code}* foi cancelado pelo *${r}*. Qualquer dúvida, fale com a gente por aqui.`,
};

const first = (o) => (o.customer_name || "").split(" ")[0];

export const brPhone = (phone) => {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
};

export function whatsappLink(o, restaurantName) {
  const phone = brPhone(o.customer_phone);
  if (!phone) return null;
  const text = (MSG[o.status] || MSG.PENDING)(o, restaurantName || "restaurante");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
