# Treinamento completo com demonstração de cada botão

Hoje cada etapa do treinamento mostra só um print + um parágrafo curto. Vou transformar cada etapa em uma "aula" completa: passo a passo detalhado, lista numerada de **todos os botões/controles** da tela com explicação do que cada um faz, e dicas práticas.

## O que muda

### 1. Modelo de dados (`src/data/trainings.ts`)

Adicionar dois campos opcionais em `TrainingStep`:

- `buttons?: { label: string; description: string }[]` — lista de todos os botões/controles visíveis no print, com nome exato e o que fazem.
- `tips?: string[]` — dicas e avisos rápidos (ex.: "use .ogg para áudio de voz", "respeite o intervalo entre envios").

A descrição principal vira um texto mais longo, em parágrafos, explicando o fluxo da tela.

### 2. Conteúdo expandido das 9 etapas

Para cada uma das 5 trilhas vou reescrever as 9 etapas existentes enumerando os botões reais da plataforma:

- **Primeiros passos** → Dashboard (cards de KPI, filtros de período, atalhos da sidebar) e Perfil (nome, foto, fuso, senha, sair).
- **Conectando o WhatsApp** → Instâncias (Nova Instância, Conectar, QR Code, Reiniciar, Desconectar, Excluir, status) e modal do QR (atualizar, fechar, indicador de expiração).
- **Inbox** → barra lateral de conversas (busca, filtros, atribuir, marcar como lida), área central (responder, áudio, anexo, emoji, template, agendar) e painel direito (dados do contato, etiquetas, mover no funil, notas).
- **Disparos em massa** → criação (instância, template, lista, intervalo, agendamento, salvar) e acompanhamento (enviadas/entregues/lidas, pausar, retomar, exportar).
- **Formulários** → builder (campos, funil de destino, link público, copiar, publicar) e respostas (visualizar, editar, excluir, exportar).

Os nomes dos botões serão tirados das telas reais (`src/pages/Dashboard.tsx`, `Inbox.tsx`, `Instances.tsx`, `Campaigns.tsx`, `Forms.tsx`, `Settings.tsx`) para baterem com o que o usuário vê.

### 3. Renderização (`src/pages/Treinamentos.tsx`)

Dentro do `AccordionContent`, abaixo do print, adicionar dois blocos novos:

- **"Botões desta tela"** — lista numerada, cada item com o nome do botão em destaque (chip/badge) e a explicação ao lado. Visual estilo "cheat sheet".
- **"Dicas"** — bullets curtos com ícone de lâmpada, só quando houver `tips`.

Mantém o checkbox "Marcar como concluído" e a barra de progresso atuais. Sem mexer em rotas, auth ou hook de progresso.

## Fora do escopo

- Não adiciono módulos novos (continuamos com as 5 trilhas já listadas).
- Não troco/gero novos prints — uso os 9 que já estão em `public/training/`.
- Não mudo o sistema de progresso nem permissões (`ALLOWED_EMAILS`).

## Resultado

Cada etapa passa a funcionar como um mini-manual: o aluno vê o print, lê o passo a passo, confere a legenda de cada botão da tela e marca como concluído.
