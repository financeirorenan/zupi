# Zupi Delivery — Apps para as lojas

| Loja | Pasta | Tecnologia | Requisitos |
|---|---|---|---|
| Google Play | `android-twa/` | Trusted Web Activity (Bubblewrap) | Node 18+, JDK 17, conta Play (US$ 25) |
| App Store | `ios-capacitor/` | Capacitor 6 (WKWebView) | Mac + Xcode 15+, conta Apple Developer (US$ 99/ano) |

Ambos carregam o site publicado (`https://www.zupidelivery.com.br/app`), então **o app na loja
atualiza sozinho** sempre que o site for republicado.

Arquivos do site que dão suporte aos apps (já criados em `frontend/public/`):
- `manifest.json`, `icon-192.png`, `icon-512.png`, `sw.js` — PWA/TWA
- `.well-known/assetlinks.json` — Android (preencher SHA-256 após gerar o keystore)
- `.well-known/apple-app-site-association` — iOS Universal Links (preencher Team ID)
- Página `/privacidade` — exigida pelas duas lojas

Ordem recomendada: **publicar o domínio → gerar Android (TWA) → enviar ao Play → depois iOS**.
