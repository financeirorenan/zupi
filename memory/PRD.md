# ZUPI DELIVERY — PRD (Product Requirements Document)

## Problema original (resumo)
Marketplace local de delivery para cidades pequenas/médias do Brasil com 3 ambientes (App/PWA do Cliente, Painel do Lojista, Painel Admin Zupi). Modelo comercial: **R$ 2,00 por pedido, sem mensalidade**. Identidade: laranja vibrante, mobile-first, extrema simplicidade. Mensagem: "O delivery da sua cidade." Requisitos: multi-cidade, multi-tenant por restaurante, pedidos com máquina de estados, cupons, promoções, avaliações, financeiro com separação contábil (produtos/entrega/descontos/taxa Zupi), suporte, auditoria, LGPD, dados demo, arquitetura escalável.

## Arquitetura
- **Backend**: FastAPI (porta 8001, prefixo /api), MongoDB via Motor, módulos: `server.py`, `database.py`, `security.py` (bcrypt+JWT em cookies HttpOnly Secure SameSite=None), `utils.py` (máquina de estados, cupons, taxa por bairro, is_open America/Sao_Paulo), `routers_auth.py`, `routers_public.py`, `routers_customer.py`, `routers_merchant.py`, `routers_admin.py`, `seed.py` (idempotente c/ marker `meta.seed_v1_done` + wipe de estado parcial).
- **Frontend**: React + Tailwind + shadcn, contextos Auth/Cart/City, carrinho em localStorage, polling 5s (kanban lojista e tracking cliente com alerta sonoro WebAudio), PWA (manifest).
- **Segurança**: RBAC (customer/restaurant/admin), rate limit de login (5/15min), reset de senha com token SHA-256 single-use + TTL, proteção de enumeração (resposta genérica), e-mail via proxy Emergent, auditoria de ações admin, validação de todos os totais no backend.
- **Financeiro**: ledger `transactions` (zupi_fee + estorno em cancelamento), taxa configurável em Admin > Sistema (padrão R$ 2,00).

## Personas
- **Cliente** (cidades pequenas, baixa familiaridade tecnológica): pede com poucos cliques, Pix/dinheiro/cartão.
- **Lojista** (pequeno restaurante): recebe pedidos em kanban com alerta sonoro, gerencia cardápio/horários/zonas/cupons, vê financeiro transparente.
- **Admin Zupi**: aprova restaurantes, gerencia cidades/categorias/banners/cupons globais, acompanha GMV e receita R$2/pedido, modera, audita.

## Implementado (14/09/2026)
- Auth completa: register/login/logout/refresh/me/perfil/esqueci-senha/reset (playbook Emergent), lockout anti-brute-force.
- Cliente: home com cidade/banners/categorias/filtros/destaques, busca por restaurante/prato, página de restaurante com cardápio+adicionais+avaliações, produto com adicionais/observações, carrinho, checkout em 3 passos (entrega/retirada + Pix/dinheiro/cartão/online), tracking com timeline em tempo real + código de retirada + Pix copia-e-cola, cancelamento, avaliação pós-entrega, histórico com "Pedir novamente", favoritos, endereços múltiplos, notificações in-app, tickets de suporte.
- Lojista: dashboard (vendas/pedidos/ticket/taxa Zupi/em andamento/avaliação/top produtos/pedidos por hora), kanban de pedidos com alerta sonoro e transições validadas, CRUD completo de cardápio (categorias/produtos/adicionais/duplicar/toggle), cupons, financeiro (bruto/descontos/entrega/taxa Zupi/líquido + extrato), avaliações, configurações (dados, zonas de entrega por bairro, horários por dia, pausar pedidos), onboarding de novo restaurante com aprovação admin.
- Admin: dashboard executivo (GMV, receita Zupi, pedidos, cancelamento, rankings), gestão de restaurantes (aprovar/bloquear/destacar/cadastrar com dono automático), clientes (bloquear/desbloquear), cidades e categorias, marketing (banners + cupons globais), financeiro (receita por restaurante, transações, pedidos com ações), sistema (taxa da plataforma, suporte, auditoria, moderação de avaliações).
- Dados demo: 7 cidades, 12 categorias, 10 restaurantes, ~56 produtos, 16 pedidos em vários status, 3 avaliações, cupons ZUPI10/BEMVINDO5/TERRA15, 2 banners, 3 clientes + 10 lojistas.
- Testes: agente QA rodou 36/37 testes backend OK + smoke frontend; corrigidos seed parcial (agora idempotente) e bloqueio de compra em restaurante fechado.

## Contas de teste
Ver `/app/memory/test_credentials.md` (admin: financeirorenanuk@gmail.com / Zupi@2026; lojista: lojista@zupi.com / zupi123; cliente: cliente@zupi.com / zupi123).

## Backlog priorizado
- **P0**: gateway de pagamento real (Stripe) + status de pagamento no pedido; push notifications reais; teste e2e UI completo do checkout via Playwright.
- **P1**: módulo Entregador (entidade preparada) + atribuição de entrega; promoções avançadas do lojista (combo, compre 2 leve 3, happy hour); upload de imagens via object storage (hoje URL); importação de cardápio em massa; geolocalização por raio/lat-long (hoje por bairro); programa de indicação antifraude.
- **P2**: gamificação (pontos/cashback/fidelidade); integração Kitchen Flow AI; WhatsApp/SMS; API pública; relatórios avançados exportáveis; app nativo.

## Próximas tarefas
1. Rodar teste e2e UI do fluxo completo checkout→kanban→entrega→avaliação.
2. Integrar Stripe (chave de teste do ambiente) para pagamento online real.
3. Upload de imagens de produtos/banners via object storage.

## 2026-06 — Correções
- Bug: crash "destroy is not a function" em /lojista/cupons e /lojista/cardapio (useEffect retornando Promise). Corrigido.
- Painel do lojista redesenhado com menu superior (layout tablet) via `DashboardLayout variant="top"`; admin mantém sidebar.

## 2026-06 — Rodada "caminho para publicar" (testado: test_reports/iteration_2.json)
- Painel lojista: menu superior (tablet); login lojista vai direto ao /lojista; botão "Ver loja no marketplace".
- Central de Pedidos: som + destaque piscante para pedidos novos; modo tela cheia com 6 colunas; escolha de motoboy ao despachar.
- Logística (/lojista/logistica): motoboys da casa (nome, telefone, veículo, diária, ativo); taxa de entrega por bairro com busca de bairros por cidade (OSM Overpass, cache db.districts, fallback endereços de pedidos, adição manual). Financeiro mostra frete cobrado x custo de diárias.
- Upload local de imagens (Emergent Object Storage): produto, capa, logo. Rotas /api/uploads/image e /api/files/{path}.
- API Aberta v1 (X-API-Key): restaurant, pause, orders, order status, menu, patch product. Webhooks assinados HMAC (order.created/status_changed/test). Tela Integrações com conectores Saipos/TakeEat/Consumer (URL+token+ativar+testar) e logs. Docs em /dev.
- Site institucional em "/" (landing + form de leads -> db.leads; GET /api/admin/leads). Marketplace movido para /app.
- PWA: manifest com ícones (raio Zupi), favicon.svg/ico, apple splash images, componente Splash em modo standalone.

### Backlog
- P1: Pagamento online (gateway).
- P2: Notificações push, importação de cardápio, service worker offline.
- Admin > Leads (/admin/leads): cards com status novo/em contato/fechado, filtros, anotações, link WhatsApp. PATCH /api/admin/leads/{id}.
- Impressão de pedidos: cupom 80mm via iframe (lib/printOrder.js); impressão automática ao chegar pedido novo com toggle "Impressão automática / Sem impressão (KDS)" (restaurant.auto_print, POST /api/merchant/auto-print); botão imprimir por ticket. Impressão silenciosa requer Chrome em modo kiosk (--kiosk-printing).
- Notificações: sino compartilhado (NotificationsBell) nos painéis admin/lojista com polling 30s; novo lead do site notifica todos os admins.
- Reset de senha testado e2e: envio real via proxy de e-mail (202 Accepted), token de uso único, expiração, login com nova senha OK.
- Relatório de motoboys (Logística): entregas concluídas, em rota, diária no período, custo por entrega, frete cobrado e saldo; períodos hoje/7/30 dias. GET /api/merchant/logistics/couriers/report?days=.
- Via da cozinha: cupom só com itens/adicionais/observações (fonte grande). Botão por ticket + toggle "2ª via cozinha" na impressão automática (restaurant.kitchen_copy).
- WhatsApp ao cliente: ícone por ticket abre wa.me com mensagem pronta conforme status do pedido (aceito, em preparo, pronto, saiu p/ entrega, entregue, cancelado).
- Avisos automáticos (Web Push): VAPID (VAPID_* no backend/.env, REACT_APP_VAPID_PUBLIC_KEY no frontend/.env), service worker public/sw.js, endpoints /api/push/subscribe (POST/DELETE) e /api/push/test; notify() dispara push para todas as assinaturas do usuário; toggle "Avisos do pedido no celular" no Perfil do cliente. Sino também mostra toast in-app ao chegar notificação nova.
- Fechamento do dia (Financeiro): GET /api/merchant/finance/closing?date=YYYY-MM-DD (fuso SP) — pedidos, vendas, por forma de pagamento, taxa Zupi, diárias dos motoboys, resultado; card na tela + cupom 80mm imprimível.
- Prontidão para deploy: seed não apaga mais dados (só semeia em banco vazio); CORS lê CORS_ORIGINS/FRONTEND_URL + regex para *.emergent.host e zupidelivery.com.br; link de reset de senha usa o Origin da requisição; .gitignore não bloqueia .env. Performance: imagens Unsplash com w=800, rotas admin/lojista/site em React.lazy (code splitting). Domínio alvo: www.zupidelivery.com.br (Hostinger DNS).
- Lojas de apps: pendente decisão do usuário (TWA/PWABuilder para Google Play; Capacitor para App Store).
