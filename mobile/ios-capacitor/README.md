# Zupi Delivery — iOS (App Store) via Capacitor

O app iOS é um contêiner nativo (WKWebView) que carrega `https://www.zupidelivery.com.br/app`.
Ícone, splash e status bar são nativos; o conteúdo vem do site publicado.

## Pré-requisitos
- Mac com Xcode 15+ e CocoaPods (`sudo gem install cocoapods`)
- Conta Apple Developer (US$ 99/ano) — https://developer.apple.com/programs/
- Site publicado em `https://www.zupidelivery.com.br`

## Passo a passo
```bash
cd mobile/ios-capacitor
npm install
npm run ios:add            # cria a pasta ios/ com o projeto Xcode
cp ../../frontend/public/icon-512.png assets/icon.png   # (crie assets/ e use um PNG 1024x1024 se tiver)
npm run assets             # gera AppIcon e Splash em todos os tamanhos
npm run ios:open           # abre no Xcode
```

No Xcode:
1. **Signing & Capabilities** → selecione seu Team; Bundle ID `br.com.zupidelivery.app`
2. Adicione a capability **Push Notifications** e **Background Modes → Remote notifications** (se quiser push nativo no futuro;
   o Web Push já funciona no Safari 16.4+ quando o app é instalado pela tela inicial)
3. Adicione **Associated Domains**: `applinks:www.zupidelivery.com.br`
   e substitua `TEAM_ID_AQUI` em `frontend/public/.well-known/apple-app-site-association` pelo seu Team ID (republique o site)
4. `Product → Archive` → **Distribute App → App Store Connect**

## App Store Connect
1. Crie o app **Zupi Delivery**, categoria *Comida e bebida*
2. Screenshots obrigatórios: iPhone 6.7" (1290×2796) e 6.5" (1284×2778) — tire com o Simulador
3. URL da política de privacidade: `https://www.zupidelivery.com.br/privacidade`
4. Conta de teste para a revisão da Apple: use um cliente demo (veja `memory/test_credentials.md`)
5. Envie para revisão (normalmente 24–48 h)

## Observações da revisão da Apple (guideline 4.2)
A Apple pode rejeitar apps que sejam "apenas um site". O Zupi tem funcionalidades nativas do app
(instalação, notificações, pedidos em tempo real, geolocalização por cidade), o que costuma bastar.
Se pedirem mais, ative os plugins nativos de Push e Geolocation já listados em `package.json`.

## Atualizações
O conteúdo vem do site — só é preciso enviar nova versão à App Store se mudar ícone, splash, nome ou plugins nativos.
