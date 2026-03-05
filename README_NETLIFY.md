# FitTrack (Vite + Supabase Auth) — Deploy no Netlify

## 1) Variáveis de ambiente no Netlify
Em **Site settings → Environment variables**, crie:

- `VITE_SUPABASE_URL` = `https://SEU-PROJETO.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = sua **chave publicável** (sb_publishable_...)

> **Não use** a `sb_secret_...` no front-end.

## 2) Configurar o Supabase (Auth)
No Supabase:

1. **Authentication → Providers → Email**
   - Ative **Email** (já está).
   - Para usar senha: mantenha **Email + Password**.
   - Para Magic Link: em geral é o mesmo provider **Email** (o app usa OTP).

2. **Authentication → URL Configuration**
   - `Site URL`: coloque seu domínio do Netlify (ex.: `https://fittrack.netlify.app`)
   - `Redirect URLs`: adicione também o domínio (e se quiser localhost: `http://localhost:5173`)

## 3) Deploy
- Faça upload do zip no Netlify (ou conecte o repo).
- O `netlify.toml` já está configurado para base `app/`.

## Observação importante
Nesta etapa, os dados ficam no **localStorage**, porém agora são **separados por usuário** (prefixo com `user.id`).
Depois, se você quiser, a gente migra para salvar tudo no banco do Supabase com RLS.
