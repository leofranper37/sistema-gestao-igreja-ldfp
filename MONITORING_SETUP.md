# 📊 Monitoramento em cPanel

## O que monitorar

Em cPanel, o monitoramento mais confiável é combinar:
- Logs da aplicação Node em Setup Node.js App
- Logs do servidor no cPanel
- Google Search Console para Core Web Vitals
- Cloudflare Web Analytics ou Google Analytics, se o domínio usar esses serviços

## Status Atual

✅ O script `public/speed-insights.js` agora é seguro fora do ambiente legado
✅ Em produção cPanel ele não tenta carregar assets externos desse fluxo
⏳ O monitoramento principal deve ser feito pelos logs do cPanel e por analytics externos

## Verificações recomendadas

1. Em Setup Node.js App, abra View Logs quando houver erro.
2. No cPanel, confira error_log e access_log do domínio.
3. No navegador, valide resposta 200 nas páginas principais.
4. No Search Console, monitore desempenho e cobertura.

## Dicas de otimização

### Imagens
```html
<img src="logo.png" alt="logo" width="100" height="100">
```

### CSS/JS crítico
```html
<style>/* critical CSS */</style>
<script src="script.js" defer></script>
```

### Fonts
```html
<link rel="preload" as="font" href="/font.woff2" crossorigin>
```

## Troubleshooting

### "Site lento"
- Reduza imagens grandes
- Evite scripts desnecessários no carregamento inicial
- Revise o cache em express.static e o peso das páginas

### "Erro 500"
- Veja o log da aplicação no cPanel
- Confirme `NODE_ENV=production`
- Confirme `APP_BASE_URL`, banco e `JWT_SECRET`

## Próximos passos

1. Conferir logs após cada deploy
2. Monitorar Search Console semanalmente
3. Usar analytics externo para tráfego e UX
