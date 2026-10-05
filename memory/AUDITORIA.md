# Auditoria Zupi Delivery — ETAPA 1 (somente leitura) — jun/2026

Método: leitura de código (backend/frontend), relatórios de teste (iteration_1..3), sondas HTTP na preview (tenant, transições, concorrência). Nenhum código alterado.

## Legenda
🟢 existe e funciona · 🟡 existe, precisa correção · 🟠 parcial · 🔴 não existe · ⚪ não validável aqui

## 3. Cidades
| Item | Status | Local / Evidência |
|---|---|---|
| Seleção de cidade | 🟢 | CityContext, CustomerLayout; Home envia `city` em /restaurants, /banners |
| Dados não vazam entre cidades | 🟢 | routers_public.py:31-93 filtra por city; cupons validam city/restaurant (utils.py:85-90); cliente só lê próprios pedidos (sonda: 403); lojista só sua loja (sonda: 404) |
| Busca respeita cidade | 🟢 | routers_public.py:81 |
| Banners por cidade | 🟢 | routers_public.py:92 (city ou global) |
| Cupons por cidade | 🟢 | AdminCouponIn.city; utils.validate_coupon |
| URL por cidade | 🟠 | cidade vive em estado/localStorage, não na URL (/app?cidade=) — funcional, não compartilhável |

## 4–5. Restaurantes / Página pública
| Item | Status | Evidência |
|---|---|---|
| Cadastro, aprovação, bloqueio, ativação, pausa, horários, abertura/fechamento automático | 🟢 | routers_admin.py:94-147, utils.is_restaurant_open:61-67 (TZ SP), pausa com bloqueio por fatura |
| Logo/capa (upload), contato, endereço, formas de pagamento, taxa, cardápio, avaliação | 🟢 | MerchantSettings + ImageUpload (WebP) |
| Página pública /restaurante/:id: capa, nome, nota, horário, aberto/fechado, cardápio, taxa, tempo, pedir, bloqueio quando fechado/esgotado | 🟢 | RestaurantPage.jsx:52-146 |
| Logo na página pública | 🟠 | só capa é exibida (RestaurantPage.jsx:52) |
| Botão compartilhar | 🔴 | não encontrado |
| URL própria (slug) | 🟠 | URL por id (`/restaurante/<uuid>`), não por slug |

## 6–7. Marketplace, carrinho, checkout
| Item | Status | Evidência |
|---|---|---|
| Home: busca, categorias, destaques, banners, filtros aberto/entrega grátis, ordenação | 🟢 | Home.jsx:11-150 |
| Filtro por avaliação mínima | 🟠 | existe ordenação por nota, não filtro |
| Produto: fotos, preço, promoção, adicionais, observações, disponibilidade | 🟢 | ProductModal, create_order valida `available` |
| Carrinho: add/remover/qtd, adicionais, obs, cupom, taxa, total, 1 restaurante por carrinho, persistência | 🟢 | CartContext.jsx (localStorage, conflito) |
| Checkout: endereços, bairro autocomplete, taxa por bairro, retirada, Pix/dinheiro/troco/cartão, obs, cupom, total server-side | 🟢 | Checkout.jsx; routers_customer.py:86-172 |
| Restaurante fechado não recebe pedido | 🟢 | routers_customer.py:91 |
| Pedido sem valor válido | 🟡 | carrinho vazio bloqueado (sonda 400); total=0 via cupom não é bloqueado explicitamente (linha 143) |
| **Duplo clique / retry não duplica pedido** | 🔴 **BLOQUEADOR** | sem chave de idempotência; sonda: 2 POSTs simultâneos idênticos → 2 pedidos (#1026, #1027). Botão desabilita (`loading`) mas não protege rede/F5 |

## 8. Ciclo do pedido
| Item | Status | Evidência |
|---|---|---|
| Fluxo completo, histórico, cliente/lojista/admin veem, push | 🟢 | status_history; polling 5s; notify()+push; iteration_1/3 |
| Status inválido / retroceder bloqueado | 🟢 | utils.TRANSITIONS; sonda DELIVERED→PENDING = 400 |
| Concorrência (2 usuários) | 🟡 | check-then-act sem filtro de status no update (merchant:152, admin:330, openapi:158, customer:202). Sonda cancel×2: 1 estorno (ok na prática), mas risco teórico de double-write/estorno duplo |

## 9–10. Falhas, recuperação, idempotência
| Item | Status | Evidência |
|---|---|---|
| Push falha não quebra pedido | 🟢 | push.py try/except, create_task |
| Webhook falha registrada | 🟢 | webhook_logs |
| Webhook retry | 🔴 | webhooks.py: 1 tentativa, timeout 10s |
| Cron idempotente | 🟢 | cron_runs por X-Webhook-Id |
| Faturamento idempotente | 🟢 | índice único (restaurant, period_start, period_end); gerar 2× = 0 novas |
| Sessão expira / refresh de token | 🟡 | backend tem /auth/refresh; api.js sem interceptor 401 → usuário cai para login após 60 min |
| Criação de pedido idempotente | 🔴 | ver bloqueador acima |
| Cupom limite sob concorrência | 🟡 | validação e $inc separados (utils.py:93; customer:141) |
| Review duplicada sob concorrência | 🟡 | flag `reviewed` sem filtro atômico, sem índice único em reviews.order_id |
| Backend reinicia / banco lento / internet cai | ⚪ | não simulado; pedidos persistem no Mongo; carrinho em localStorage |

## 11–14. Painel lojista, cardápio, logística, impressão
| Item | Status | Evidência |
|---|---|---|
| Dashboard, kanban, alerta sonoro, destaque, tela cheia, retrato/paisagem, auto-refresh, motoboy, WhatsApp, KDS toggle | 🟢 | iteration_3 |
| Impressão 80mm, automática, 2ª via cozinha | 🟢 | lib/printOrder.js |
| Não imprimir duplicado | 🟡 | 2 abas abertas imprimem 2× (knownIds por aba, sem marca servidor) |
| KDS externo recebe/atualiza | 🟢 | via API v1 + webhook (iteration_2) |
| Cardápio: categorias, produtos, fotos WebP, promo, adicionais, disponibilidade, exclusão, duplicar | 🟢 | MerchantMenu |
| Ordem de categorias/produtos editável | 🟠 | campo `order` existe, sem UI de reordenar |
| Logística completa (motoboy, bairros, taxa, relatório) | 🟢 | iteration_2 + sondas |

## 15–16. Financeiro e Faturamento
| Item | Status | Evidência |
|---|---|---|
| Vendas, descontos, taxa, Zupi, líquido, diárias, fechamento, impressão | 🟢 | finance, finance/closing |
| Taxa Zupi = pedidos × taxa; 1 transação por pedido; estorno em cancelamento | 🟢 | customer:165; reversal em 4 caminhos |
| Pedidos de teste excluídos da fatura | 🟠 | não há flag "pedido de teste"; dependem de cancelamento |
| Períodos, config global/por lojista, geração, vencimento, status, pagar, Pix, bloqueio/reativação | 🟢 | routers_billing.py; iteration_3; sonda bloqueio |
| Lembrete | 🟢 | cron diário |

## 17–20. Cupons, avaliações, notificações, suporte
| Item | Status | Evidência |
|---|---|---|
| Cupons lojista/plataforma (limite, validade, mín, %/fixo, cidade) | 🟢 | CouponIn / AdminCouponIn |
| Reuso por usuário | 🟠 | só `first_purchase`; não há "1 uso por cliente" |
| Percentual > 100% | 🟡 | sem `le=100`; total clampado ≥0 mas `discount` pode exceder subtotal |
| Avaliação só após DELIVERED, 1 por pedido, média, moderação | 🟢 | customer:251-278; admin:376 |
| Push por status, sino, lido/não lido, histórico | 🟢 | |
| Dedupe de notificações | 🟠 | notify() sempre insere (não observado duplicar em uso normal) |
| Suporte cliente (abrir, responder, histórico, status) e admin (ver, responder, encerrar) | 🟢 | iteration_3 |
| Identificar lojista no chamado | 🟠 | ticket guarda user; lojista ainda não abre chamado pelo painel |

## 21–23. Integrações, admin, saúde
| Item | Status | Evidência |
|---|---|---|
| API v1 completa, HMAC, logs, conectores com teste | 🟢 | iteration_2 |
| Retry webhook/conector | 🔴 | |
| Admin: todas as telas listadas + auditoria + impersonação (banner, voltar, registro, tenant) | 🟢 | iteration_3 + sonda |
| Saúde da plataforma (webhooks com erro, push, e-mail, storage) | 🟠 | existe dashboard de negócio e logs de webhook por lojista; `/api/health` é estático (não checa Mongo/storage) |
| Saúde da cidade (restaurantes, pedidos, GMV, receita por cidade) | 🟢 | admin/dashboard.by_city |
| Clientes ativos / crescimento por cidade | 🟠 | não há série por cidade |

## 25–27. Performance, PWA, lojas
| Item | Status | Evidência |
|---|---|---|
| APIs ~0,2s, imagens WebP/800px, lazy routes, índices Mongo (users, orders, products, invoices…) | 🟢 | server.py:56-80 |
| Paginação | 🔴 | nenhum endpoint pagina (caps fixos 100–500) — ok para cidades pequenas, risco em 12+ meses |
| Manifest, ícones, splash, instalação iOS/Android, push, sessão/carrinho preservados | 🟢 | confirmado pelo usuário no iOS |
| Service worker cache/offline | 🔴 | sw.js só push |
| TWA/Capacitor/assetlinks/AASA/privacidade | 🟢 | /app/mobile |
| Screenshots, descrição, login em produção | ⚪ | só após publicar |

## 28–29. LGPD / Banco
| Item | Status | Evidência |
|---|---|---|
| Política de privacidade | 🟢 | /privacidade |
| Termos de uso | 🔴 | não existe página nem aceite no cadastro |
| Exclusão de conta / exportação de dados | 🔴 | só via ticket manual (Profile.jsx:140) |
| Operação destrutiva protegida | 🟢 | seed só em banco vazio; delete_many sempre escopados |
| Backup/restauração | ⚪/🔴 | nenhum mecanismo na app; depende da plataforma de deploy |

## 30–32. Carga, caos, auditoria
| Item | Status | Evidência |
|---|---|---|
| Teste de carga / caos | ⚪ | não executado |
| Auditoria: admin (restaurante, cidade, usuário, status, review, settings), faturas, impersonação, bloqueio | 🟢 | utils.audit call sites |
| Auditoria: login/logout, status pelo lojista/API, cancelamento pelo cliente, alteração de preço, emissão de fatura | 🔴 | sem audit() nesses pontos (login_attempts existe) |

---

## 33. GO / NO-GO — resultado: 🔴 NOT READY (1 bloqueador) → vira 🟡 READY WITH CONDITIONS após corrigir

### LISTA 1 — JÁ EXISTE E FUNCIONA (não mexer)
Cidades/tenant, restaurantes e página pública, marketplace, carrinho, checkout (cálculo), ciclo do pedido e transições, push/sino, suporte, painel lojista (kanban, som, tela cheia, rotação, impressão, KDS, WhatsApp), cardápio, logística, financeiro, faturamento + bloqueio, cupons (regras), avaliações, API v1/webhooks/conectores, admin completo, impersonação, PWA, projetos de lojas, privacidade, índices, imagens.

### LISTA 2 — EXISTE, MAS PRECISA CORRIGIR (mínima alteração)
🔴 **B1 Idempotência na criação de pedido** (bloqueador): frontend envia `client_order_id` (uuid gerado ao abrir checkout); backend recusa/retorna o pedido existente se já houver com mesmo id+cliente (índice único parcial). ~15 linhas.
🟠 **A1 Transições atômicas**: `update_one({"id", "status": status_atual})` nos 4 caminhos de status/cancel; se `matched_count==0` → 409. Elimina estorno duplo.
🟠 **A2 Retry de webhook/conector**: 3 tentativas com backoff (0s, 5s, 30s) dentro de `_post`, logando tentativa.
🟡 **M1 Refresh de sessão**: interceptor 401 em api.js chamando /auth/refresh uma vez.
🟡 **M2 Impressão duplicada em 2 abas**: lock via `localStorage` (printed:<orderId>) com BroadcastChannel simples.
🟡 **M3 Cupom**: `le=100` em percent; incremento atômico `used_count < max_uses`.
🟡 **M4 Auditoria**: audit() em login/logout, status pelo lojista/API, cancel do cliente, preço de produto, emissão de fatura.
🟡 **M5 Total zero**: rejeitar pedido com `total <= 0` (exceto se for intenção comercial — confirmar).

### LISTA 3 — REALMENTE NÃO EXISTE (avaliar necessidade)
Necessário p/ lançamento: **Termos de Uso** (página + aceite no cadastro; exigido pelas lojas) · **Exclusão de conta self-service** (LGPD/App Store exige).
Desejável: compartilhar restaurante · health check real (Mongo/storage) · paginação admin · cache offline no SW · ordem de categorias/produtos · chamados de suporte pelo lojista · filtro por nota · slug de URL.
Fora da app: backup/restore (plataforma) · teste de carga/caos (ambiente de produção).
