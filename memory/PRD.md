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
