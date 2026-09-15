# Zupi Delivery — Android (Google Play) via TWA

O app Android é um **Trusted Web Activity**: o Chrome abre `https://www.zupidelivery.com.br/app`
em tela cheia, sem barra de endereço, usando o PWA já publicado (ícones, splash, push).

## Pré-requisitos
- Site publicado em `https://www.zupidelivery.com.br` (obrigatório)
- Node.js 18+ e JDK 17 (o Bubblewrap baixa o Android SDK sozinho)
- Conta Google Play Console (taxa única de US$ 25)

## Passo a passo
```bash
npm i -g @bubblewrap/cli
cd mobile/android-twa
bubblewrap init --manifest https://www.zupidelivery.com.br/manifest.json   # aceite os valores já preenchidos em twa-manifest.json
bubblewrap build    # gera app-release-signed.apk e app-release-bundle.aab + cria android.keystore
```
> Guarde `android.keystore` e a senha em local seguro. Sem ele não é possível atualizar o app na Play Store.

## Digital Asset Links (remove a barra do Chrome)
1. Pegue a impressão digital SHA-256 do keystore:
   `keytool -list -v -keystore android.keystore -alias zupi | grep SHA256`
2. Cole em `frontend/public/.well-known/assetlinks.json` substituindo `SHA256_FINGERPRINT_AQUI`.
3. Republique o site. Verifique em `https://www.zupidelivery.com.br/.well-known/assetlinks.json`.
4. Depois de publicar no Play, adicione também a impressão digital do **"App signing key"** do Play Console
   (Play Console → Setup → App integrity) no mesmo arquivo — são duas entradas no array.

## Publicação
1. Play Console → Criar app → **Zupi Delivery**, categoria *Alimentos e bebidas*
2. Faça upload do `app-release-bundle.aab` em *Produção* (ou *Teste interno* primeiro)
3. Preencha: descrição, screenshots (celular 1080×1920, ao menos 2), ícone 512×512 (`frontend/public/icon-512.png`),
   política de privacidade `https://www.zupidelivery.com.br/privacidade`, formulário de segurança de dados
4. Envie para revisão (1–3 dias)

## Atualizações
Como o conteúdo vem do site, **atualizações do app não precisam de nova versão na loja**.
Só publique nova versão se mudar ícone, nome, cores ou o `twa-manifest.json` (incremente `appVersionCode`).
