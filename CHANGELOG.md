# CHANGELOG - Sistema de Indicações Tenno Core

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.2.0] - 2026-10-19
### Modificado
- **Campos do Kommo Opcionais (`AdminConfiguracoes`)**:
  - Removida a obrigatoriedade dos campos de Subdomínio e Bearer Token do Kommo CRM.
  - Clínicas que não utilizam o Kommo agora conseguem salvar normalmente o WhatsApp da clínica, mensagem personalizada de redirecionamento, nome da plataforma e logotipo.
  - `admin-api` atualizado para tratar dados do Kommo como opcionais/nulos com segurança.

---

## [1.1.0] - 2026-10-16
### Adicionado
- **Rastreamento de Cliques no Link (`AdminIndicadores`)**:
  - Nova métrica de "Cliques no Link" contabilizada a partir da tabela `referral_clicks`.
  - Exibição de estatísticas enriquecidas por indicador:
    - Cliques no link.
    - Indicações totais.
    - Pontos convertidos (acumulado histórico).
    - Pontos consumidos (prêmios resgatados).
    - Saldo atual de pontos.
- **Suporte Multi-Tenant Supabase**:
  - Headers `Accept-Profile` e `Content-Profile` dinâmicos via `VITE_SUPABASE_SCHEMA`.
  - Edge Functions unificadas com chave `SERVICE_ROLE_KEY`.

### Modificado
- `AdminIndicadores.tsx`: Layout reformulado com cards e badges modernos de métricas.

---

## [1.0.0] - 2026-10-10
### Adicionado
- Plataforma base de indicações com formulário de cadastro de indicador.
- Geração de link único `/r/{codigo}` com compartilhamento via WhatsApp.
- Painel do Indicador (`/entrar`) com histórico de indicações e saldo de pontos.
- Painel Administrativo com autenticação por PIN.
- Sincronização de leads com CRM Kommo (contatos, tarefas e notas).
- Configurações administrativas dinâmicas (nome, logo, regras, telefone).
