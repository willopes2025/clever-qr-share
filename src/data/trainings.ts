// Conteúdo dos treinamentos.
// Para adicionar uma nova etapa, coloque a imagem em /public/training/<modulo>/<etapa>.png
// e adicione um novo objeto em `steps` abaixo.

export type TrainingButton = {
  label: string;
  description: string;
};

export type TrainingStep = {
  id: string; // ID único e estável (não mude depois de publicado)
  title: string;
  description: string;
  image?: string; // caminho público, ex: "/training/inbox/01.png"
  buttons?: TrainingButton[];
  tips?: string[];
};

export type TrainingModule = {
  id: string;
  title: string;
  description: string;
  videoUrl?: string; // ex: "https://www.youtube.com/embed/XXXX" ou .mp4
  steps: TrainingStep[];
};

export const trainings: TrainingModule[] = [
  {
    id: "inicio",
    title: "Primeiros passos",
    description: "Conheça a plataforma, configure seu acesso e a organização.",
    steps: [
      {
        id: "inicio-1",
        title: "Acessando o painel",
        description:
          "Depois de fazer **login**, você cai direto no **Dashboard**. Siga este passo a passo para se ambientar:\n\n1. Observe o **menu lateral à esquerda** — ele dá acesso a todos os módulos (**Inbox**, **Funis**, **Contatos**, **Campanhas**, **Formulários**, **Tarefas**, **Calendário**, **Instâncias**, **IA**).\n2. No topo, use o **seletor de organização** para trocar de empresa quando você tem acesso a mais de uma.\n3. Clique no **sininho** para ver notificações em tempo real (mensagens novas, tarefas atribuídas, alertas).\n4. Clique no seu **avatar** (canto superior direito) para abrir **Perfil**, **Configurações**, **Tema** e **Sair**.\n5. No corpo do Dashboard, clique em qualquer **card de KPI** (Conversas, Leads, Campanhas, Tarefas) para ir direto ao módulo.\n6. Ajuste o **filtro de período** (Hoje, 7 dias, 30 dias, personalizado) para mudar o intervalo dos gráficos.",
        image: "/training/inicio/01.png",
        buttons: [
          { label: "Menu lateral (sidebar)", description: "Lista todos os módulos: Inbox, Funis, Contatos, Campanhas, Formulários, Tarefas, Calendário, Instâncias, IA, etc. Clique no ícone para abrir o módulo." },
          { label: "Recolher menu (←/→)", description: "Botão no topo da sidebar que recolhe a barra deixando só os ícones, dando mais espaço ao conteúdo principal." },
          { label: "Seletor de organização", description: "No topo, troca entre organizações às quais você tem acesso. Tudo o que aparece no Dashboard se refere à organização ativa." },
          { label: "Sininho de notificações", description: "Mostra novas mensagens, tarefas atribuídas e alertas do sistema em tempo real." },
          { label: "Avatar / Perfil", description: "Abre o menu com Perfil, Configurações, Tema (claro/escuro) e Sair." },
          { label: "Cards de KPI", description: "Conversas abertas, leads no funil, campanhas ativas e tarefas pendentes. Clique em um card para ir direto ao módulo correspondente." },
          { label: "Filtros de período", description: "Ajustam o intervalo (Hoje, 7 dias, 30 dias, personalizado) usado nos gráficos e nos números do Dashboard." },
        ],
        tips: [
          "Se um card aparecer zerado logo após o cadastro, é normal — ele se preenche conforme você conecta o WhatsApp e começa a receber mensagens.",
          "O Dashboard respeita as permissões do usuário: você só vê dados das instâncias e funis aos quais tem acesso.",
        ],
      },
      {
        id: "inicio-2",
        title: "Configurando seu perfil",
        description:
          "Para ajustar seus dados pessoais e preferências:\n\n1. Clique no seu **avatar** no canto superior direito e selecione **Configurações**.\n2. Vá na aba **Perfil**.\n3. Clique na **foto** para enviar uma nova imagem.\n4. Preencha **Nome completo**, **Telefone** e confira o **E-mail** de login.\n5. Selecione o **Fuso horário** alinhado ao seu local de trabalho — ele é usado em campanhas, automações e relatórios.\n6. Para trocar a senha, clique em **Alterar senha** e siga o fluxo.\n7. Escolha o **Tema** (claro ou escuro) no topo da tela.\n8. Aperte **Salvar alterações** — sem isso, nada é gravado.",
        image: "/training/inicio/02.png",
        buttons: [
          { label: "Foto de perfil", description: "Clique na imagem para enviar uma nova foto. Ela aparece nas conversas internas e no avatar do topo." },
          { label: "Nome completo", description: "Como você é identificado nas conversas internas, atribuições de tarefas e respostas do Inbox." },
          { label: "E-mail", description: "É o e-mail usado para login. Em geral não pode ser alterado por aqui." },
          { label: "Telefone", description: "Usado para contato interno e em algumas notificações." },
          { label: "Fuso horário", description: "Define a referência de horário para campanhas, automações e agendamentos. Deixe sempre alinhado com o seu local de trabalho." },
          { label: "Alterar senha", description: "Abre o fluxo para definir uma nova senha. Recomendado a cada poucos meses." },
          { label: "Tema claro / escuro", description: "Alterna a aparência da interface. A escolha fica salva no seu usuário." },
          { label: "Salvar alterações", description: "Confirma e grava as mudanças no perfil. Sem clicar aqui, as alterações são descartadas ao sair da tela." },
        ],
        tips: [
          "Use o mesmo fuso horário dos seus clientes principais — assim os relatórios de horário de pico fazem sentido.",
          "Se você atende junto com outras pessoas, coloque foto e nome reais: isso ajuda no controle interno de quem respondeu cada conversa.",
        ],
      },
      {
        id: "inicio-3",
        title: "Configurando a organização",
        description:
          "Para configurar os dados da empresa (visíveis para todos os membros):\n\n1. Abra **Configurações** pelo avatar no topo direito.\n2. Vá na aba **Organização**.\n3. Preencha o **Nome da organização** — ele aparece em e-mails do sistema e no seletor do topo.\n4. Clique em **Logo** para subir a imagem da empresa (PNG quadrado, fundo transparente).\n5. Selecione o **Fuso horário da organização** (ex.: **America/Sao_Paulo**) — é a fonte oficial de horário do backend.\n6. Ative ou desative **Criação automática de lead** para que toda conversa nova vire um cartão no funil padrão.\n7. Escolha o **Funil padrão** que receberá esses leads.\n8. Aperte **Salvar** para aplicar a todos os membros.",
        buttons: [
          { label: "Nome da organização", description: "Aparece no seletor de organização do topo, em e-mails do sistema e em formulários públicos." },
          { label: "Logo da empresa", description: "Aparece no topo da sidebar e em formulários públicos. Recomendado PNG quadrado com fundo transparente." },
          { label: "Fuso horário da organização", description: "Fuso padrão (IANA, ex.: America/Sao_Paulo) usado por todo o backend para agendar campanhas e automações." },
          { label: "Criação automática de lead", description: "Quando ativado, toda nova conversa de WhatsApp já vira um cartão no funil padrão automaticamente." },
          { label: "Funil padrão", description: "Define em qual funil os novos leads entram quando não há regra mais específica (formulário, campanha)." },
          { label: "Salvar", description: "Aplica as alterações para todos os membros da organização." },
        ],
        tips: [
          "Só donos (owner) e admins veem e alteram essas configurações.",
          "Mudar o fuso horário recalcula a exibição de horários em todos os relatórios — combine com a equipe antes.",
        ],
      },
      {
        id: "inicio-4",
        title: "Equipe e permissões",
        description:
          "Para convidar e organizar o time:\n\n1. Vá em **Configurações > Equipe**.\n2. Clique em **Convidar membro** no canto superior direito — abrirá um **popup**.\n3. Digite o **e-mail** da pessoa e escolha o **Cargo** (**Owner**, **Admin** ou **Membro**).\n4. Aperte **Enviar convite**. A pessoa recebe um link para definir a própria senha.\n5. Depois que ela aceitar, clique no nome do membro para abrir o painel de **Permissões personalizadas**.\n6. Ative/desative o acesso por módulo (**Inbox**, **Funis**, **Campanhas**, **IA**, **Financeiro**).\n7. Em **Instâncias permitidas**, marque quais números de WhatsApp esse membro pode usar.\n8. Em **Funis permitidos**, restrinja a quais funis ele tem acesso.\n9. Aperte **Salvar**. Para tirar acesso, clique nos **três pontinhos** ao lado do membro e selecione **Remover**.",
        buttons: [
          { label: "Convidar membro", description: "Envia um convite por e-mail. O membro define a própria senha ao aceitar." },
          { label: "Cargo (Owner / Admin / Membro)", description: "Owner tem controle total e não pode ser removido. Admins gerenciam quase tudo. Membros têm acesso limitado pelas permissões." },
          { label: "Permissões personalizadas", description: "Liga/desliga acesso a cada módulo (Inbox, Funis, Campanhas, IA, Financeiro, etc.) por membro." },
          { label: "Instâncias permitidas", description: "Define quais números de WhatsApp esse membro pode usar para enviar mensagens." },
          { label: "Funis permitidos", description: "Restringe quais funis o membro consegue ver e editar." },
          { label: "Remover membro", description: "Tira o acesso imediatamente. O histórico de mensagens enviadas por ele continua preservado." },
          { label: "Reenviar convite", description: "Útil quando o membro não recebeu ou perdeu o e-mail original." },
        ],
        tips: [
          "Comece com poucas permissões e libere conforme a necessidade — é mais seguro.",
          "Membros sem instância liberada veem o Inbox vazio, mesmo com permissão de visualização.",
        ],
      },
    ],
  },
  {
    id: "instancias",
    title: "Conectando o WhatsApp",
    description: "Crie e conecte sua instância para começar a enviar e receber mensagens.",
    steps: [
      {
        id: "instancias-1",
        title: "Criando uma nova instância",
        description:
          "Para conectar um número de WhatsApp à plataforma:\n\n1. No menu lateral, clique em **Instâncias**.\n2. Aperte o botão **Nova Instância** no canto superior direito — abrirá um **popup**.\n3. Digite um **nome amigável** (ex.: **Vendas SP**, **Suporte**).\n4. Escolha o **tipo** de instância (Evolution para chips comuns, Meta para número oficial).\n5. Clique em **Criar**. A instância aparece na lista com o status **Aguardando QR**.\n6. Em seguida, na linha da instância recém-criada, clique em **Conectar / QR Code** para abrir o pareamento.\n7. Acompanhe o **badge de status**: verde = conectado, amarelo = aguardando QR, vermelho = desconectado.",
        image: "/training/instancias/01.png",
        buttons: [
          { label: "Nova Instância", description: "Abre o formulário para cadastrar um novo número. Você dá um nome amigável (ex.: Vendas, Suporte) e a instância é criada já pronta para conectar." },
          { label: "Conectar / QR Code", description: "Abre o modal com o QR Code para parear o WhatsApp do celular com a instância." },
          { label: "Reiniciar", description: "Reinicia a conexão da instância sem precisar escanear o QR de novo. Útil quando a instância trava ou fica lenta." },
          { label: "Desconectar", description: "Encerra a sessão atual. O número continua cadastrado, mas para de enviar e receber até você reconectar." },
          { label: "Excluir", description: "Remove a instância permanentemente. Use com cuidado: o histórico vinculado a ela deixa de ser acessível para enviar respostas." },
          { label: "Status (badge colorido)", description: "Verde = conectado, amarelo = aguardando QR, vermelho = desconectado. Passe o mouse para ver detalhes." },
          { label: "Configurações da instância", description: "Ícone de engrenagem (ou três pontinhos). Permite renomear, definir webhook, ativar/desativar a IA e configurar horários." },
        ],
        tips: [
          "Dê nomes claros às instâncias (ex.: 'Vendas SP', 'Suporte') — eles aparecem em campanhas, automações e no Inbox.",
          "Antes de conectar, certifique-se de que o chip está aquecido. Números novos com disparo em massa caem rápido.",
        ],
      },
      {
        id: "instancias-2",
        title: "Escaneando o QR Code",
        description:
          "Para parear o celular com a instância:\n\n1. Na lista de **Instâncias**, clique em **Conectar** — abrirá um **modal** com o **QR Code**.\n2. No seu celular, abra o **WhatsApp**.\n3. Toque em **Configurações > Aparelhos conectados**.\n4. Aperte **Conectar um aparelho** e aponte a câmera para o **QR Code** na tela do computador.\n5. Aguarde o indicador mudar de **Aguardando leitura** para **Conectado**.\n6. Se o QR ficar cinza ou aparecer aviso de expiração, clique em **Atualizar QR Code** para gerar um novo.\n7. Quando ver **Conectado**, clique no **X** para fechar o modal.",
        image: "/training/instancias/02.png",
        buttons: [
          { label: "QR Code", description: "Imagem que deve ser escaneada pelo WhatsApp do celular. Ele tem validade curta (em geral menos de 1 minuto)." },
          { label: "Atualizar QR Code", description: "Gera um novo QR caso o atual tenha expirado. Use sempre que o código ficar cinza ou aparecer um aviso de expiração." },
          { label: "Indicador de status", description: "Mostra 'Aguardando leitura', 'Conectando...' e por fim 'Conectado'. Quando aparecer Conectado, pode fechar o modal." },
          { label: "Fechar (X)", description: "Fecha o modal. Se a instância ainda não foi conectada, você pode voltar e tentar de novo a qualquer momento." },
        ],
        tips: [
          "Mantenha o celular conectado à internet por alguns segundos depois de escanear, para a sessão sincronizar.",
          "Se o QR não for lido após 2 tentativas, reinicie a instância e gere um novo.",
        ],
      },
      {
        id: "instancias-3",
        title: "Configurações avançadas da instância",
        description:
          "Para configurar comportamento avançado de uma instância:\n\n1. Na lista de **Instâncias**, clique no ícone de **engrenagem** (ou nos **três pontinhos**) da instância desejada.\n2. Abrirá o painel de **Configurações da instância**.\n3. Em **Renomear**, ajuste o nome de exibição se precisar.\n4. Ative a opção **Ativar IA** para que o agente configurado responda automaticamente.\n5. Defina o **Horário de atendimento** marcando os dias e o intervalo de horas.\n6. Escreva a **Mensagem fora do expediente** que será enviada automaticamente fora desse horário.\n7. Em **Webhook personalizado**, cole a URL externa (Make/n8n) para receber eventos.\n8. Em **Atribuição automática**, escolha o método (**round-robin**, **manual** ou **por funil**).\n9. Selecione o **Funil padrão da instância** para novos contatos.\n10. Aperte **Salvar** para aplicar.",
        buttons: [
          { label: "Renomear instância", description: "Muda o nome exibido. O nome técnico interno (usado pela Evolution API) continua o mesmo." },
          { label: "Ativar IA", description: "Liga o agente de IA configurado para responder automaticamente nas conversas dessa instância." },
          { label: "Horário de atendimento", description: "Define em quais dias e horas a IA / automações respondem. Fora desse horário cai uma mensagem padrão." },
          { label: "Mensagem fora do expediente", description: "Texto enviado automaticamente quando uma mensagem chega fora do horário configurado." },
          { label: "Webhook personalizado", description: "URL externa (ex.: Make, n8n) que recebe cada evento de mensagem dessa instância." },
          { label: "Atribuição automática", description: "Define como novos contatos são distribuídos entre os atendentes (round-robin, manual ou por funil)." },
          { label: "Funil padrão da instância", description: "Funil em que novos contatos dessa instância entram automaticamente." },
          { label: "Conexão Meta (oficial)", description: "Para instâncias oficiais, mostra o número, phone_number_id e status da aprovação Meta." },
        ],
        tips: [
          "O horário de atendimento usa o fuso da organização — confira antes de ativar.",
          "Webhooks só recebem eventos depois de salvos; teste com uma mensagem real para validar.",
        ],
      },
    ],
  },
  {
    id: "inbox",
    title: "Inbox - Atendendo conversas",
    description: "Use o Inbox para responder clientes, anexar arquivos e organizar contatos.",
    steps: [
      {
        id: "inbox-1",
        title: "Visão geral do Inbox",
        description:
          "Para se ambientar com o Inbox:\n\n1. No menu lateral, clique em **Inbox**.\n2. Observe as **três áreas**: à esquerda a **lista de conversas**, no centro o **histórico**, à direita o **painel do contato**.\n3. Use a **caixa de busca** no topo da lista para procurar por **nome**, **telefone** ou **trecho de mensagem**.\n4. Use as abas **Todas / Não lidas / Minhas** para alternar a visualização.\n5. Clique no ícone de **filtros avançados** para combinar instância, etiqueta, funil, responsável ou período.\n6. Clique em uma **conversa** para abri-la no centro.\n7. No **cabeçalho da conversa**, use os botões rápidos: **Atribuir responsável**, **Mover no funil**, **Encerrar**.\n8. No **painel direito**, edite nome, telefone, etiquetas, **campos personalizados** e adicione **notas internas**.",
        image: "/training/inbox/01.png",
        buttons: [
          { label: "Busca de conversas", description: "Procura por nome, telefone ou trecho de mensagem. A busca é feita no servidor, então funciona mesmo em conversas antigas." },
          { label: "Filtros (Todas / Não lidas / Minhas)", description: "Alterna entre todas as conversas, só as não lidas ou apenas as atribuídas a você." },
          { label: "Filtros avançados", description: "Filtra por instância, etiqueta, funil, responsável ou período. Combine vários filtros para criar visões salvas." },
          { label: "Item da conversa", description: "Mostra avatar, nome, última mensagem e um badge com a quantidade de não lidas. Clique para abrir a conversa." },
          { label: "Atribuir responsável", description: "Define qual atendente é dono da conversa. As notificações passam a ir para essa pessoa." },
          { label: "Marcar como lida / não lida", description: "Atualiza o status visual da conversa sem precisar abri-la." },
          { label: "Cabeçalho da conversa", description: "Mostra o contato, instância em uso e botões rápidos: ligar, mover no funil, abrir contato, encerrar." },
          { label: "Painel direito (Contato)", description: "Editar nome, telefone, etiquetas, campos personalizados, ver oportunidades no funil e adicionar notas internas." },
        ],
        tips: [
          "O Inbox só mostra contatos com histórico de WhatsApp. Para ver todos os contatos cadastrados use o módulo Contatos.",
          "Notas internas não são enviadas ao cliente — use para registrar combinados internos.",
        ],
      },
      {
        id: "inbox-2",
        title: "Enviando mensagens e mídias",
        description:
          "Para enviar texto, mídia ou agendar uma mensagem:\n\n1. Com a conversa aberta, clique no **campo de mensagem** na parte inferior.\n2. Digite o texto. Use **Shift+Enter** para quebrar linha e **Enter** para enviar.\n3. Para anexar arquivo, clique no **clipe** e selecione **imagem**, **vídeo**, **documento** ou **áudio** — também pode arrastar e soltar.\n4. Para gravar áudio, segure o ícone de **microfone** e fale. Solte para enviar como mensagem de voz.\n5. Clique no **emoji** para abrir o seletor.\n6. Para usar um template, clique em **Template** e escolha um da lista — variáveis como **{{nome}}** são preenchidas automaticamente.\n7. Para programar o envio, clique em **Agendar envio**, escolha **data** e **hora** e confirme.\n8. Aperte o **avião** (ou **Enter**) para enviar agora.",
        image: "/training/inbox/02.png",
        buttons: [
          { label: "Campo de mensagem", description: "Digite o texto. Aceita quebra de linha com Shift+Enter e variáveis como {{nome}} se vier de um template." },
          { label: "Clipe / Anexar", description: "Envia imagem, vídeo, documento ou áudio do seu computador. Suporta arrastar e soltar." },
          { label: "Microfone / Gravar áudio", description: "Grava um áudio diretamente no navegador. É enviado como mensagem de voz (.ogg)." },
          { label: "Emoji", description: "Abre o seletor de emojis para inserir no texto." },
          { label: "Template", description: "Insere um template pronto (texto ou mídia). Em números oficiais (Meta), é obrigatório para abrir conversas fora da janela de 24h." },
          { label: "Agendar envio", description: "Programa a mensagem para uma data e hora específicas. Ela é enviada automaticamente no horário marcado." },
          { label: "Enviar (avião)", description: "Dispara a mensagem agora. Atalho: Enter." },
        ],
        tips: [
          "Áudios devem ser .ogg com codec opus para o WhatsApp reconhecer como mensagem de voz — gravando pelo microfone do navegador isso já é automático.",
          "Imagens enviadas como documento mantêm a qualidade original; como imagem, o WhatsApp comprime.",
          "Templates oficiais com variáveis precisam que os campos do lead (nome, etc.) estejam preenchidos.",
        ],
      },
      {
        id: "inbox-3",
        title: "Organizando: etiquetas, notas e tarefas",
        description:
          "Para organizar a conversa no painel direito:\n\n1. Com a conversa aberta, olhe o **painel direito**.\n2. Clique em **Etiquetas** para aplicar tags coloridas (ex.: **VIP**, **Quente**, **Reclamação**).\n3. Em **Notas**, clique em **Adicionar nota interna** e escreva — não vai para o cliente. Use **@menção** para alertar um colega.\n4. Em **Tarefas**, clique em **Criar tarefa**, defina **responsável**, **prazo** e **tipo**.\n5. No **cabeçalho da conversa**, clique em **Mover no funil** para empurrar o cartão para outra etapa.\n6. Para passar a conversa a outro atendente, clique em **Transferir conversa** e escolha o membro.\n7. Para unir conversas do mesmo contato (número antigo + novo), clique em **Mesclar conversas**.\n8. Quando resolvida, clique em **Encerrar conversa** — pode reabrir se o cliente voltar a falar.",
        buttons: [
          { label: "Etiquetas / Tags", description: "Aplique tags coloridas (ex.: VIP, Quente, Reclamação). Servem para filtrar conversas e segmentar listas." },
          { label: "Adicionar nota interna", description: "Escreve uma observação só visível para a equipe. Não vai para o cliente." },
          { label: "Criar tarefa", description: "Gera uma tarefa vinculada à conversa, com responsável, prazo e tipo. Aparece no módulo Tarefas e no Calendário." },
          { label: "Mover no funil", description: "Empurra o cartão do contato para outra etapa do funil sem sair da conversa." },
          { label: "Transferir conversa", description: "Atribui a conversa a outro membro da equipe. Ele recebe notificação na hora." },
          { label: "Mesclar conversas", description: "Une duas conversas do mesmo contato (ex.: número antigo + número novo) em uma só, preservando o histórico." },
          { label: "Encerrar conversa", description: "Marca como resolvida. Pode reabrir a qualquer momento se o cliente voltar a falar." },
        ],
        tips: [
          "Use etiquetas com cor para visualizar rapidamente o tipo de conversa na lista.",
          "Notas internas suportam @menção para alertar um colega específico.",
          "Encerrar não bloqueia o contato — ele só sai dos filtros de 'em andamento'.",
        ],
      },
    ],
  },
  {
    id: "funis",
    title: "Funis (CRM Kanban)",
    description: "Organize seus leads em etapas visuais e automatize transições.",
    steps: [
      {
        id: "funis-1",
        title: "Entendendo o Kanban",
        description:
          "Para começar a usar o Kanban de funis:\n\n1. No menu lateral, clique em **Funis**.\n2. No **seletor de funil** (topo), escolha o funil desejado ou clique em **Novo funil** para criar um.\n3. Ao criar um funil, dê **nome**, **cor** e clique em **Editar etapas** para definir as colunas.\n4. Em **Editar etapas**, clique em **Adicionar etapa**, escreva o nome e arraste para reordenar.\n5. Alterne entre **Visão Kanban** e **Visão Lista** pelo botão no topo direito.\n6. Use **Filtros** para mostrar só leads de um responsável, etiqueta, valor, data ou campo personalizado.\n7. Use a **Busca** para encontrar um cartão por nome, telefone ou conteúdo.\n8. Para mover um lead, **clique e arraste** o cartão de uma coluna para outra — isso dispara as **automações** da etapa de destino.",
        buttons: [
          { label: "Seletor de funil", description: "No topo, alterna entre os funis criados (Vendas, Suporte, etc.)." },
          { label: "Novo funil", description: "Cria um funil do zero com etapas personalizadas. Você define nome, cor e regras." },
          { label: "Editar etapas", description: "Adiciona, remove, renomeia e reordena as colunas. Mudanças afetam todos os cartões existentes." },
          { label: "Filtros de cartões", description: "Filtra por responsável, etiqueta, valor, data, campo personalizado etc." },
          { label: "Busca", description: "Encontra um cartão por nome do contato, telefone ou conteúdo do campo." },
          { label: "Visão Kanban / Lista", description: "Alterna entre o quadro de colunas (Kanban) e uma tabela completa (Lista) com mais detalhes." },
          { label: "Cartão de lead", description: "Mostra nome, foto, etiquetas, valor, último contato e responsável. Clique para abrir o painel completo." },
          { label: "Arrastar cartão", description: "Segure e arraste de uma coluna para outra. Dispara automaticamente as automações da etapa de destino." },
        ],
        tips: [
          "Mantenha o número de etapas baixo (5 a 8) — funis muito longos viram bagunça visual.",
          "Cores diferentes nas etapas ajudam a identificar urgência (verde = quente, vermelho = parado).",
        ],
      },
      {
        id: "funis-2",
        title: "Cartão de lead e automações",
        description:
          "Para abrir um lead e configurar automações:\n\n1. No quadro do funil, **clique em um cartão** — abrirá o **painel lateral** completo.\n2. Em **Dados do contato**, edite nome, telefone, e-mail, empresa e campos personalizados.\n3. Use as abas **Conversas**, **Tarefas**, **Notas** e **Atividades** para acessar cada parte do histórico.\n4. Preencha o **Valor da oportunidade** para alimentar o pipeline financeiro.\n5. Para configurar automações, volte ao quadro, clique em **Editar etapa** (cabeçalho da coluna).\n6. Em **Automações**, clique em **Adicionar regra** e escolha o gatilho **Ao entrar nesta etapa**.\n7. Selecione a ação: **Enviar mensagem**, **Criar tarefa**, **Mover de funil**, **Aplicar etiqueta**.\n8. Aperte **Salvar**. Para mover o cartão para outro funil, use o botão **Mover para outro funil** dentro do cartão.\n9. Para unir cartões duplicados do mesmo telefone, clique em **Mesclar leads**.",
        buttons: [
          { label: "Dados do contato", description: "Edita nome, telefone, e-mail, empresa, campos personalizados." },
          { label: "Conversas", description: "Lista todas as conversas de WhatsApp desse contato. Clique para abrir no Inbox." },
          { label: "Tarefas", description: "Cria e acompanha tarefas vinculadas a esse lead. Aparecem também no Calendário." },
          { label: "Notas", description: "Anotações internas da equipe sobre o lead." },
          { label: "Atividades", description: "Linha do tempo de tudo que aconteceu: mudanças de etapa, mensagens, tarefas concluídas." },
          { label: "Valor da oportunidade", description: "Número monetário usado para o pipeline financeiro do funil." },
          { label: "Automações da etapa", description: "Em Editar etapa, configure regras: 'ao entrar nesta etapa, envie a mensagem X', 'crie tarefa Y', 'mova depois de N dias'." },
          { label: "Mover para outro funil", description: "Transfere o cartão para um funil diferente preservando histórico." },
          { label: "Mesclar leads", description: "Une dois cartões do mesmo contato (1 contato = 1 telefone; pode ter vários deals)." },
          { label: "Excluir cartão", description: "Remove a oportunidade. O contato e o histórico de mensagens continuam." },
        ],
        tips: [
          "Use automações de etapa para 'cobrar' leads parados: 'após 3 dias sem mensagem, enviar follow-up'.",
          "1 Contato pode ter vários cartões (deals). Não duplique contatos só porque mudou de funil.",
          "Campos personalizados do cartão (deal) são diferentes dos do contato — use deal para dados da venda, contato para dados pessoais.",
        ],
      },
    ],
  },
  {
    id: "contatos",
    title: "Contatos",
    description: "Gerencie sua base de contatos, importe CSV e crie campos personalizados.",
    steps: [
      {
        id: "contatos-1",
        title: "Lista e busca de contatos",
        description:
          "Para gerenciar sua base completa de contatos:\n\n1. No menu lateral, clique em **Contatos**.\n2. Use o campo **Busca** no topo para procurar por **nome**, **telefone** ou **e-mail**.\n3. Clique em **Filtros avançados** para combinar etiqueta, cidade, data de cadastro ou campo personalizado.\n4. Para cadastrar manualmente, aperte **Novo contato** — abrirá um formulário.\n5. Para importar em massa, clique em **Importar CSV**, selecione o arquivo e **mapeie as colunas**. O sistema importa em **lotes de 25**.\n6. Para editar vários ao mesmo tempo, marque os checkboxes e clique em **Edição em massa** (lotes de 50).\n7. Para unir duplicados, aperte **Mesclar duplicados** — o sistema detecta pelo telefone normalizado.\n8. Para baixar a base, clique em **Exportar** e escolha o formato CSV.",
        buttons: [
          { label: "Busca", description: "Procura por nome, telefone ou e-mail. Suporta busca parcial." },
          { label: "Filtros avançados", description: "Combine múltiplos critérios: etiqueta, cidade, data de cadastro, campo personalizado." },
          { label: "Novo contato", description: "Abre formulário para cadastrar manualmente. Útil para leads vindos de telefone ou indicação." },
          { label: "Importar CSV", description: "Sobe um arquivo .csv com vários contatos. O sistema mapeia colunas e importa em lotes de 25 para evitar travadas." },
          { label: "Exportar", description: "Baixa a lista filtrada em CSV. Útil para backup ou análises externas." },
          { label: "Edição em massa", description: "Selecione vários contatos e edite etiquetas, campos ou funil de uma vez (em lotes de 50)." },
          { label: "Mesclar duplicados", description: "Detecta contatos com o mesmo telefone normalizado e permite fundir mantendo o histórico." },
          { label: "Excluir em massa", description: "Apaga vários contatos selecionados. Operação irreversível, use com cuidado." },
        ],
        tips: [
          "Telefones são normalizados para o formato 55 + DDD + número antes de salvar — não importa o formato do CSV.",
          "Antes de uma importação grande, faça um teste com 10 linhas para validar o mapeamento das colunas.",
        ],
      },
      {
        id: "contatos-2",
        title: "Campos personalizados",
        description:
          "Para criar um novo campo personalizado:\n\n1. Vá em **Configurações > Campos personalizados**.\n2. Clique em **Novo campo personalizado** — abrirá um **popup**.\n3. Digite o **Rótulo** (ex.: **CPF**, **Vencimento**, **Cidade**).\n4. Escolha o **Tipo**: **Texto**, **Número**, **Data**, **Hora**, **Seleção** ou **Múltipla escolha**.\n5. Marque **Obrigatório** se o contato não puder ser salvo sem esse dado.\n6. Aperte **Salvar**.\n7. Para preencher, abra a **ficha do contato** e clique no campo — a edição é **inline**, basta sair do campo que salva.\n8. Para usar em templates/campanhas, insira **{{nome_do_campo}}** no texto — o valor é substituído no envio.",
        buttons: [
          { label: "Novo campo personalizado", description: "Em Configurações > Campos personalizados. Defina rótulo, tipo (texto, número, data, hora, seleção, múltipla escolha) e se é obrigatório." },
          { label: "Tipo de campo", description: "Escolha o tipo certo — datas vão para calendário/automações, números fazem soma em relatórios, seleção limita opções." },
          { label: "Tornar obrigatório", description: "Bloqueia salvar o contato sem preencher esse campo. Útil para CPF, vencimento etc." },
          { label: "Editar valor no contato", description: "Na ficha do contato, clique no campo para editar inline. Salva ao perder o foco." },
          { label: "Usar como variável", description: "Em templates e campanhas, use {{nome_do_campo}} para inserir o valor automaticamente." },
        ],
        tips: [
          "Use o mesmo campo personalizado em todos os lugares (template + filtro + formulário) para manter consistência.",
          "Campos do tipo data podem disparar automações (ex.: lembrete 5 dias antes do vencimento).",
        ],
      },
    ],
  },
  {
    id: "listas",
    title: "Listas de Transmissão",
    description: "Crie listas (estáticas ou dinâmicas) para usar em disparos de campanha.",
    steps: [
      {
        id: "listas-1",
        title: "Criando uma lista",
        description:
          "Para criar uma lista de transmissão:\n\n1. No menu lateral, clique em **Listas de Transmissão**.\n2. Aperte **Nova lista** no canto superior direito.\n3. Digite o **nome** e uma **descrição** opcional.\n4. Escolha o **tipo**: **Estática** (você adiciona contatos manualmente) ou **Dinâmica** (filtros que atualizam sozinhos).\n5. Se for **Dinâmica**, clique em **Adicionar filtro** e combine critérios (etiqueta, campo personalizado, instância, funil).\n6. Se for **Estática**, clique em **Adicionar contatos**, selecione da base ou cole os números.\n7. Aperte **Salvar lista**.\n8. Depois de salva, use **Ver contatos** para conferir os membros e **Histórico de envios** para ver as campanhas que usaram a lista.",
        buttons: [
          { label: "Nova lista", description: "Cria uma lista do zero. Você define nome, tipo (estática/dinâmica) e descrição." },
          { label: "Tipo: Estática", description: "Você adiciona os contatos manualmente. A lista não muda sozinha." },
          { label: "Tipo: Dinâmica", description: "Você define filtros (ex.: 'tag = VIP E cidade = SP'). A lista se atualiza sozinha conforme novos contatos entram." },
          { label: "Adicionar filtro", description: "Em listas dinâmicas, define critérios baseados em etiquetas, campos personalizados, instância ou funil." },
          { label: "Adicionar contatos", description: "Em listas estáticas, abre um seletor para escolher contatos da base ou colar números." },
          { label: "Ver contatos", description: "Mostra todos os membros atuais da lista, com paginação para listas grandes." },
          { label: "Histórico de envios", description: "Lista todas as campanhas que usaram essa lista, com data e resultado." },
          { label: "Duplicar lista", description: "Cria uma cópia para você modificar sem perder a original." },
        ],
        tips: [
          "Listas dinâmicas são desduplicadas automaticamente — o mesmo contato nunca recebe duas vezes na mesma campanha.",
          "Liste pelos filtros mais restritivos primeiro (a query fica mais rápida).",
        ],
      },
    ],
  },
  {
    id: "templates",
    title: "Templates de Mensagem",
    description: "Mensagens prontas reutilizáveis, com variáveis, mídia, áudio TTS e variações por IA.",
    steps: [
      {
        id: "templates-1",
        title: "Criando templates",
        description:
          "Para criar um template de mensagem:\n\n1. No menu lateral, clique em **Templates**.\n2. Aperte **Novo template**.\n3. Digite o **nome** (ex.: **cobranca_5dias**), escolha **categoria** e **canal** (**Evolution** ou **Meta oficial**).\n4. Escreva o texto. Para inserir variáveis, clique em **Inserir variável** e escolha **{{nome}}**, **{{vencimento}}**, etc.\n5. Para anexar mídia, clique em **Anexar mídia** e suba imagem, vídeo, documento ou áudio.\n6. Para gerar áudio narrado, clique em **Gerar áudio (TTS)** — usa **ElevenLabs**.\n7. Para criar variações, clique em **Gerar variações com IA** e escolha quantas versões quer.\n8. Aperte **Pré-visualizar** para conferir como fica no WhatsApp.\n9. Clique em **Salvar**. Em templates Meta, aperte **Enviar para aprovação** antes de usar.",
        buttons: [
          { label: "Novo template", description: "Cria um template do zero. Defina nome, categoria e canal (Evolution ou Meta oficial)." },
          { label: "Inserir variável", description: "Clica no campo de variáveis para inserir {{nome}}, {{vencimento}} etc. Os valores são preenchidos no envio." },
          { label: "Anexar mídia", description: "Sobe uma imagem/vídeo/documento que vai junto com o texto. Em mídias, o sistema envia texto primeiro e mídia 2s depois." },
          { label: "Gerar áudio (TTS)", description: "Converte texto em áudio usando ElevenLabs. Útil para mensagens humanizadas em campanhas." },
          { label: "Gerar variações com IA", description: "Cria N versões parecidas do texto para alternar nos envios e reduzir risco de bloqueio." },
          { label: "Pré-visualizar", description: "Mostra como a mensagem fica no WhatsApp do cliente, com variáveis de exemplo." },
          { label: "Template oficial Meta", description: "Envia o template para aprovação na Meta. Só depois de aprovado pode ser usado em números oficiais." },
          { label: "Duplicar / Excluir", description: "Duplica para criar variações ou apaga em definitivo." },
        ],
        tips: [
          "Nomes com hífen ou underline ficam mais legíveis em listas (ex.: cobranca_5dias).",
          "Variáveis vazias caem para um espaço ' ' por padrão — assim você nunca tem 'Olá ,' no envio.",
          "Templates oficiais Meta precisam de variáveis numeradas ({{1}}, {{2}}) e seguem regras da Meta.",
        ],
      },
    ],
  },
  {
    id: "campanhas",
    title: "Disparos em massa",
    description: "Aprenda a criar campanhas de envio para listas de contatos.",
    steps: [
      {
        id: "campanhas-1",
        title: "Criando uma campanha",
        description:
          "Para criar uma campanha de disparo em massa:\n\n1. No menu lateral, clique em **Disparos** (ou **Campanhas**).\n2. Aperte **Nova Campanha** — abrirá o assistente.\n3. Digite o **Nome da campanha** (ex.: **Black Friday 2026**).\n4. Em **Instância(s)**, marque um ou mais números — com vários, o sistema distribui a carga automaticamente.\n5. Em **Template / Mensagem**, escolha um template salvo ou escreva mensagem livre.\n6. Em **Lista de contatos**, selecione uma **lista de transmissão** ou faça **upload de CSV**.\n7. Defina o **Intervalo entre envios** (mínimo e máximo em segundos — recomendado **15 a 60s** para Evolution).\n8. Em **Janela de horário**, escolha o intervalo permitido (ex.: **9h às 18h**).\n9. Para programar, ative **Agendar início** e escolha **data** e **hora**.\n10. Opcional: ative **Modo chatbot** ou **Agente de IA** para respostas automáticas.\n11. Selecione o **Funil de destino dos leads** para acompanhar respostas.\n12. Antes de começar, clique em **Salvar rascunho** e revise. Quando estiver pronto, aperte **Iniciar campanha**.",
        image: "/training/campanhas/01.png",
        buttons: [
          { label: "Nome da campanha", description: "Identificação interna — aparece em relatórios e histórico. Use algo descritivo como 'Black Friday 2026'." },
          { label: "Instância(s)", description: "Selecione um ou mais números para enviar. Com várias, o sistema distribui automaticamente a carga." },
          { label: "Template / Mensagem", description: "Escolha um template oficial ou escreva uma mensagem livre. Templates suportam variáveis como {{nome}}, {{vencimento}}." },
          { label: "Lista de contatos", description: "Selecione uma lista de transmissão pronta ou faça upload de um arquivo CSV. A lista pode ser dinâmica (atualiza sozinha)." },
          { label: "Intervalo entre envios", description: "Tempo mínimo e máximo (em segundos) entre uma mensagem e outra. Recomenda-se de 15 a 60 segundos para chips Evolution." },
          { label: "Janela de horário", description: "Define entre quais horas a campanha pode disparar (ex.: das 9h às 18h). Fora dessa janela ela pausa e retoma no dia seguinte." },
          { label: "Agendar início", description: "Permite começar a campanha em uma data e hora específicas, em vez de imediatamente." },
          { label: "Modo chatbot", description: "Em vez de só uma mensagem, dispara um fluxo de chatbot completo para cada contato da lista." },
          { label: "Agente de IA da campanha", description: "Liga um agente de IA (gpt-4.1-nano) que pode responder às respostas dos contatos usando a ferramenta send_template." },
          { label: "Funil de destino dos leads", description: "Define em qual funil/etapa cada contato da campanha vai entrar, para acompanhar as respostas." },
          { label: "Salvar rascunho", description: "Salva a campanha sem começar a enviar — útil para revisar antes." },
          { label: "Iniciar campanha", description: "Confirma e coloca a campanha na fila de envio respeitando as regras configuradas." },
        ],
        tips: [
          "Em números oficiais (Meta), só é possível disparar templates aprovados. Em Evolution, mensagem livre é permitida.",
          "Sempre teste a campanha em uma lista pequena (5–10 contatos) antes do envio em massa.",
          "Variáveis com nome em branco caem para um espaço ' ' por padrão, evitando 'Olá ,'.",
          "Com várias instâncias selecionadas, o sistema balanceia a carga — bom para volumes maiores.",
        ],
      },
      {
        id: "campanhas-2",
        title: "Acompanhando o envio",
        description:
          "Para acompanhar uma campanha em andamento:\n\n1. Em **Disparos**, clique na campanha desejada para abrir o painel.\n2. Acompanhe os **cards de progresso** no topo: **Total**, **Enviadas**, **Entregues**, **Lidas**, **Respondidas** e **Falhas** (tudo em tempo real).\n3. Olhe a **barra de progresso** para ver o percentual e a estimativa de tempo restante.\n4. Para suspender, clique em **Pausar** — a fila não se perde.\n5. Para continuar, aperte **Retomar**.\n6. Para encerrar, clique em **Cancelar** (o restante da fila é descartado).\n7. Para investigar falhas, clique no contato e em **Ver detalhes do erro** — mostra a mensagem exata do provedor.\n8. Depois de corrigir, aperte **Reenviar falhas** para tentar de novo só nos que falharam.\n9. Aperte **Exportar resultados** para baixar um CSV com status de cada destinatário.",
        image: "/training/campanhas/02.png",
        buttons: [
          { label: "Cards de progresso", description: "Mostram: Total, Enviadas, Entregues, Lidas, Respondidas e Falhas. Atualizados em tempo real." },
          { label: "Barra de progresso", description: "Percentual concluído e estimativa de tempo restante com base no intervalo configurado." },
          { label: "Pausar", description: "Suspende a campanha sem perder a fila. Útil se um número começar a apresentar problema." },
          { label: "Retomar", description: "Continua de onde parou, respeitando o intervalo e a janela de horário." },
          { label: "Cancelar", description: "Encerra definitivamente. Os já enviados continuam contando; o restante da fila é descartado." },
          { label: "Exportar resultados", description: "Baixa um CSV com cada destinatário, status do envio e mensagem de erro (se houver)." },
          { label: "Reenviar falhas", description: "Refaz o disparo apenas para os contatos que falharam (ex.: número inválido, sem WhatsApp). Use depois de corrigir a lista." },
          { label: "Ver detalhes do erro", description: "Em cada falha, clique para ver a mensagem exata retornada pelo provedor — facilita identificar bloqueios ou números incorretos." },
        ],
        tips: [
          "Se a taxa de falhas passar de ~10%, pause e revise: pode ser problema no chip ou na lista.",
          "Respostas dos contatos aparecem direto no Inbox, já vinculadas à campanha.",
        ],
      },
    ],
  },
  {
    id: "calendario",
    title: "Calendário",
    description: "Visualize e crie tarefas e compromissos em dia, semana ou mês.",
    steps: [
      {
        id: "calendario-1",
        title: "Visões e navegação",
        description:
          "Para usar o Calendário no dia a dia:\n\n1. No menu lateral, clique em **Calendário**.\n2. No topo, escolha a visão **Dia**, **Semana** ou **Mês**.\n3. Use as **setas ← →** para avançar ou recuar e o botão **Hoje** para voltar à data atual.\n4. Em **Filtro de responsável**, escolha um membro específico ou **Todos**.\n5. Em **Filtro por tipo de tarefa**, filtre por **Ligar**, **Reunião**, **Visita** etc.\n6. Para conectar com sua agenda do Google, clique em **Integração Google Calendar** e siga o login.\n7. Clique em um **card de tarefa** para abrir detalhes, editar, marcar como concluída ou ir ao contato relacionado.",
        buttons: [
          { label: "Visão Dia / Semana / Mês", description: "Alterna entre os formatos de visualização. Semana é o padrão na maioria dos times comerciais." },
          { label: "Navegar (← →)", description: "Avança/recua um dia, semana ou mês, conforme a visão ativa." },
          { label: "Hoje", description: "Volta direto para a data atual." },
          { label: "Filtro de responsável", description: "Mostra só as tarefas de um membro específico ou de todos." },
          { label: "Filtro por tipo de tarefa", description: "Filtra por tipo (Ligar, Visitar, Reunião, etc.). Você cria os tipos em Configurações." },
          { label: "Integração Google Calendar", description: "Conecta com sua agenda do Google para ver eventos externos no mesmo calendário." },
          { label: "Card de tarefa", description: "Clique para ver detalhes, editar, marcar como concluída ou abrir o contato relacionado." },
        ],
        tips: [
          "Tarefas vinculadas a um lead/contato aparecem com o nome dele — facilita preparar o atendimento.",
          "A integração Google é por usuário (cada um conecta a própria agenda em Configurações > Integrações).",
        ],
      },
      {
        id: "calendario-2",
        title: "Criando uma tarefa ou evento",
        description:
          "Para criar uma tarefa ou evento:\n\n1. No **Calendário**, **clique em um horário** vago ou aperte **Nova tarefa** no topo direito — abrirá um **popup**.\n2. Digite o **Título** (ex.: **Ligar para João sobre proposta**).\n3. Escolha o **Tipo** (**Ligação**, **Reunião**, **Visita**, **Follow-up**).\n4. Selecione a **Data** e **Hora**. Em eventos com duração, defina também o **fim**.\n5. Em **Responsável**, escolha o membro do time que ficará dono da tarefa.\n6. (Opcional) Vincule um **Contato** ou **Deal** — aparece na ficha do lead.\n7. (Opcional) Em **Mensagem associada**, escreva o texto que será enviado ao contato no horário da tarefa.\n8. Ative **Repetir** para criar série diária, semanal ou mensal.\n9. Aperte **Salvar** — a tarefa aparece no **Calendário**, em **Tarefas** e na ficha do contato.",
        buttons: [
          { label: "Título", description: "Resumo curto da tarefa (ex.: 'Ligar para João sobre proposta')." },
          { label: "Tipo", description: "Categoria da tarefa: Ligação, Reunião, Visita, Follow-up. Cores diferentes ajudam na visão semanal." },
          { label: "Data e hora", description: "Quando a tarefa começa. Em eventos com duração, defina também o fim." },
          { label: "Responsável", description: "Quem é dono da tarefa. Ele recebe a notificação no sininho e em e-mail (se configurado)." },
          { label: "Contato / Deal vinculado", description: "Opcional — conecta a tarefa a um lead. Aparece na ficha do contato e do cartão de funil." },
          { label: "Mensagem associada", description: "Texto que pode ser enviado para o contato no momento da tarefa (ex.: lembrete de reunião)." },
          { label: "Repetir", description: "Cria uma série recorrente (diária, semanal, mensal)." },
          { label: "Salvar", description: "Cria a tarefa e ela aparece na visão de Calendário, em Tarefas e na ficha do contato." },
        ],
        tips: [
          "Use tarefas como follow-up automático após reuniões: ao concluir uma, crie a próxima já na hora.",
          "Quem é dono do contato e quem é dono da tarefa podem ser pessoas diferentes — útil para gestores acompanharem o time.",
        ],
      },
    ],
  },
  {
    id: "tarefas",
    title: "Tarefas",
    description: "Lista unificada de tudo que você e a equipe precisam fazer.",
    steps: [
      {
        id: "tarefas-1",
        title: "Lista e filtros de tarefas",
        description:
          "Para organizar as tarefas do dia:\n\n1. No menu lateral, clique em **Tarefas**.\n2. No topo, use as abas **Minhas**, **Equipe**, **Vencidas** e **Hoje** para filtrar.\n3. Comece pela aba **Hoje** — vem ordenada por horário.\n4. Para criar uma nova, clique em **Nova tarefa** e preencha o formulário.\n5. Para marcar como concluída, clique no **checkbox** ao lado da tarefa.\n6. Para editar, clique no **ícone de lápis** — abre o detalhamento.\n7. Para ir ao lead vinculado, aperte **Abrir contato vinculado**.\n8. Em vencidas (destaque vermelho), clique e atualize a data ou conclua. Tarefas vencidas são o principal sinal de leads esfriando.",
        buttons: [
          { label: "Abas (Minhas / Equipe / Vencidas / Hoje)", description: "Filtra rapidamente o que mostrar. 'Vencidas' destaca o que passou do prazo e ainda não foi concluído." },
          { label: "Filtro de responsável", description: "Quando admin, restringe à pessoa selecionada." },
          { label: "Filtro de tipo", description: "Mostra só Ligações, só Reuniões etc." },
          { label: "Nova tarefa", description: "Cria uma tarefa diretamente daqui, sem precisar abrir o calendário." },
          { label: "Marcar como concluída", description: "Checkbox que finaliza a tarefa. Aparece riscada e sai dos filtros de pendentes." },
          { label: "Editar", description: "Abre o detalhamento para mudar título, data, responsável, vínculo." },
          { label: "Abrir contato vinculado", description: "Atalho que leva direto para a ficha do lead/contato da tarefa." },
          { label: "Excluir", description: "Remove a tarefa em definitivo." },
        ],
        tips: [
          "Comece o dia pela aba 'Hoje' — ela já vem ordenada por horário.",
          "Vencidas em vermelho são o principal sinal de que um lead está esfriando. Aja sobre elas primeiro.",
        ],
      },
    ],
  },
  {
    id: "chat-interno",
    title: "Chat Interno",
    description: "Converse com a equipe sem sair da plataforma.",
    steps: [
      {
        id: "chat-interno-1",
        title: "Chat 1-a-1 e grupos",
        description:
          "Para conversar com a equipe sem sair da plataforma:\n\n1. No menu lateral, clique em **Chat Interno**.\n2. Para falar com alguém, aperte **Nova conversa**, escolha o membro e clique em **Iniciar**.\n3. Para criar grupo, clique em **Novo grupo**, defina o **nome** e marque os **membros**.\n4. Selecione a conversa na **lista à esquerda** — não lidas aparecem em **negrito** com badge.\n5. No **campo de mensagem**, digite o texto. Use **@menção** para alertar alguém específico.\n6. Para anexar arquivo, clique no **clipe** e escolha imagem, documento ou áudio.\n7. Em grupos, abra os **detalhes** para **Adicionar membro** ou **Sair do grupo**.\n8. O badge no **menu lateral** mostra o total não lido em tempo real.",
        buttons: [
          { label: "Nova conversa", description: "Inicia uma conversa direta com outro membro da equipe." },
          { label: "Novo grupo", description: "Cria um grupo, escolhe nome e membros. Útil para times grandes ou projetos." },
          { label: "Lista de conversas", description: "Mostra todas as conversas internas em ordem de atividade. Não lidas aparecem em negrito." },
          { label: "Campo de mensagem", description: "Texto, emoji e anexos. Suporta @menção para alertar alguém específico." },
          { label: "Anexar arquivo", description: "Envia imagens, documentos e áudios para a conversa interna." },
          { label: "Notificações", description: "Cada membro pode silenciar conversas específicas. O badge no menu lateral mostra o total não lido." },
          { label: "Adicionar membro ao grupo", description: "Em grupos, o admin pode incluir ou remover participantes." },
          { label: "Sair do grupo", description: "Remove você do grupo. Outros membros continuam com a conversa." },
        ],
        tips: [
          "Use o Chat Interno para alinhamentos rápidos — assim a conversa com o cliente fica limpa de mensagens internas.",
          "Para registrar algo permanente sobre um lead, prefira Notas internas dentro da conversa do Inbox.",
        ],
      },
    ],
  },
  {
    id: "chatbots",
    title: "Chatbots",
    description: "Crie fluxos automatizados de atendimento sem programar.",
    steps: [
      {
        id: "chatbots-1",
        title: "Construtor de fluxos",
        description:
          "Para montar um chatbot visualmente:\n\n1. No menu lateral, clique em **Chatbots**.\n2. Aperte **Novo fluxo** — abrirá o **construtor**.\n3. Dê um **nome** e escolha o **gatilho inicial** (palavra-chave, entrada em etapa de funil, campanha em modo chatbot).\n4. **Arraste** blocos do painel lateral para a tela: **Mensagem**, **Pergunta**, **Condição**, **Delay**, **Ação**, **Template Meta**.\n5. Conecte os blocos arrastando a **alça de saída** de um até a **entrada** do próximo.\n6. Em blocos de **Pergunta**, defina onde salvar a resposta (variável ou campo personalizado).\n7. Em **Condição**, configure os caminhos **Sim** e **Não** baseados em variáveis, etiquetas ou campos.\n8. Aperte **Testar fluxo** e informe um número de teste para simular sem afetar leads reais.\n9. Quando estiver pronto, clique em **Publicar** — para desativar, use **Despublicar**.\n10. Acompanhe o desempenho em **Analytics**: entradas, conclusões e ponto de abandono.",
        buttons: [
          { label: "Novo fluxo", description: "Cria um chatbot do zero. Você dá um nome e escolhe o gatilho inicial." },
          { label: "Bloco Mensagem", description: "Envia texto, mídia ou template ao contato." },
          { label: "Bloco Pergunta", description: "Faz uma pergunta e captura a resposta em uma variável ou campo personalizado." },
          { label: "Bloco Condição (if)", description: "Ramifica o fluxo conforme valor da variável, etiqueta, campo do contato etc." },
          { label: "Bloco Delay", description: "Espera N segundos/minutos/horas/dias antes de seguir. Suporta delays longos com agendamento." },
          { label: "Bloco Ação", description: "Move o lead no funil, aplica etiqueta, cria tarefa, chama webhook, envia para humano." },
          { label: "Bloco Template Meta", description: "Envia um template oficial Meta — necessário para abrir conversa fora da janela de 24h." },
          { label: "Conectar blocos", description: "Arraste a alça de saída de um bloco para a entrada do próximo. Em condições, cada caminho (sim/não) vira uma saída." },
          { label: "Testar fluxo", description: "Simula a execução com um número de teste sem afetar leads reais." },
          { label: "Publicar / Despublicar", description: "Liga ou desliga o fluxo. Despublicado, o gatilho deixa de disparar." },
          { label: "Analytics", description: "Mostra quantos contatos entraram, quantos chegaram em cada bloco e onde abandonaram." },
        ],
        tips: [
          "Fluxos curtos convertem melhor. Se passar de 6–8 perguntas, considere quebrar em dois.",
          "Para qualificar leads, use o bloco Condição para mover automaticamente o lead 'frio' para um funil de nutrição.",
          "Sempre coloque um bloco Ação no final para transferir para humano se o cliente pedir.",
        ],
      },
    ],
  },
  {
    id: "ai-agents",
    title: "Agentes de IA",
    description: "Configure agentes para responder clientes 24/7 com base no seu negócio.",
    steps: [
      {
        id: "ai-agents-1",
        title: "Criando um agente",
        description:
          "Para criar um agente de IA para responder pelo WhatsApp:\n\n1. No menu lateral, clique em **Agentes de IA**.\n2. Aperte **Novo agente** — escolha começar **do zero** ou a partir de um **Template** (Vendas, SDR, Atendimento, Cobrança).\n3. Preencha o **Nome** e descreva a **Personalidade** (formal, descontraído, técnico).\n4. Em **Instruções (prompt)**, escreva o que o agente deve fazer, o que evitar e como agir em casos específicos.\n5. Em **Base de conhecimento**, clique em **Adicionar** e suba **PDF**, **DOCX**, **planilha** ou cole **URL de site**.\n6. Em **Ferramentas**, ative as capacidades: **create_task** (cria tarefa para humano), **send_template** (dispara template), **mover de funil**, **agendar**.\n7. Em **Mídia por etapa**, defina imagens/vídeos que o agente envia em cada etapa do funil.\n8. Clique em **Testar agente** — abre um chat de teste. Converse como se fosse cliente.\n9. Quando errar, use **Correção de mensagem** para registrar a resposta certa.\n10. Para colocar em produção, vá no funil, abra **Editar etapa** e em **Ativar IA** selecione o agente.",
        buttons: [
          { label: "Novo agente", description: "Cria um agente do zero ou a partir de um template (Vendas, SDR, Atendimento, Cobrança)." },
          { label: "Template de agente", description: "Modelos prontos com prompt, ferramentas e base de conhecimento pré-configurados." },
          { label: "Nome e personalidade", description: "Define como o agente se apresenta e o tom (formal, descontraído, técnico)." },
          { label: "Instruções (prompt)", description: "Texto principal que diz ao agente o que fazer, o que evitar e como agir em casos específicos." },
          { label: "Base de conhecimento", description: "Sobe documentos (PDF, DOCX, planilha, sites). O agente consulta antes de responder." },
          { label: "Ferramentas", description: "Liga capacidades como create_task (criar tarefa para humano), send_template (disparar template oficial), mover de funil, agendar." },
          { label: "Mídia por etapa", description: "Configura quais imagens/vídeos o agente envia em cada etapa do funil." },
          { label: "Testar agente", description: "Abre um chat de teste para conversar com o agente como se fosse um cliente." },
          { label: "Correção de mensagem", description: "Quando o agente erra, você corrige a resposta — vira sugestão de treinamento futuro." },
          { label: "Exportar agente", description: "Gera um JSON com toda a configuração para mover entre organizações ou fazer backup." },
          { label: "Ativar no funil", description: "Liga o agente em uma etapa específica do funil — ele só responde leads que estão naquela etapa." },
        ],
        tips: [
          "Comece com objetivo bem estreito (ex.: só qualificar lead) — agentes 'fazem tudo' tendem a errar mais.",
          "Reveja as conversas dos primeiros 7 dias e use a Correção de Mensagem nos pontos fracos.",
          "Para ações sensíveis (fechar venda, dar desconto) prefira a ferramenta create_task — humano resolve, IA notifica.",
        ],
      },
    ],
  },
  {
    id: "pesquisa-leads",
    title: "Pesquisa de Leads",
    description: "Encontre empresas e contatos para prospectar usando dados públicos (CNAE/IBGE).",
    steps: [
      {
        id: "pesquisa-leads-1",
        title: "Buscando empresas por atividade",
        description:
          "Para prospectar empresas usando dados do IBGE/CNAE:\n\n1. No menu lateral, clique em **Pesquisa de Leads**.\n2. Em **CNAE / Atividade**, selecione a atividade econômica (ex.: **4774-1/00 - Comércio varejista de artigos de óptica**).\n3. Em **Estado**, escolha a UF — isso libera os filtros seguintes.\n4. Em **Município**, escolha a cidade na lista carregada do IBGE.\n5. (Opcional) Refine com **Distrito / Bairro**.\n6. Aperte **Buscar** — os resultados aparecem em uma **tabela paginada**.\n7. Marque os checkboxes ou use **Selecionar tudo** para escolher os que quer aproveitar.\n8. Para gerar oportunidades, clique em **Enviar para funil** e escolha o funil/etapa.\n9. Para adicionar à base, clique em **Importar como contatos**.\n10. Para baixar a lista, aperte **Exportar CSV**.",
        buttons: [
          { label: "CNAE / Atividade", description: "Selecione a atividade econômica (ex.: 4774-1/00 - Comércio varejista de artigos de óptica)." },
          { label: "Estado", description: "Filtra por UF. Necessário para liberar os campos de cidade/distrito." },
          { label: "Município", description: "Lista carregada dinamicamente do IBGE para o estado escolhido." },
          { label: "Distrito / Bairro", description: "Refina ainda mais a região da busca." },
          { label: "Buscar", description: "Executa a consulta e mostra os resultados em tabela paginada." },
          { label: "Tabela de resultados", description: "Lista nome da empresa, CNPJ, telefone, e-mail, endereço e atividade principal." },
          { label: "Selecionar tudo / em massa", description: "Marca todos os resultados visíveis ou aplica ações em vários ao mesmo tempo." },
          { label: "Exportar CSV", description: "Baixa os resultados filtrados em planilha." },
          { label: "Enviar para funil", description: "Cria automaticamente um cartão no funil escolhido para cada empresa selecionada." },
          { label: "Importar como contatos", description: "Adiciona os resultados à base de contatos para usar em campanhas." },
        ],
        tips: [
          "Quanto mais específico o CNAE, melhor a qualidade da lista — evita misturar segmentos.",
          "Antes de disparar campanhas para empresas vindas daqui, valide os telefones (muitos fixos não recebem WhatsApp).",
        ],
      },
      {
        id: "pesquisa-leads-2",
        title: "Instagram Scraper",
        description:
          "Para coletar perfis e comentários públicos do Instagram:\n\n1. Em **Pesquisa de Leads**, abra a aba **Instagram Scraper**.\n2. Escolha o modo de busca:\n  - **Buscar por perfil**: cole o **@** ou **URL** e o sistema lista os seguidores públicos.\n  - **Buscar por post**: cole a **URL do post** e veja quem comentou (com texto do comentário).\n  - **Buscar por palavra-chave**: digite o termo para encontrar perfis cuja **bio/nome** contém ele.\n3. Aperte **Buscar** e aguarde os resultados.\n4. Use **Filtrar resultados** para reduzir por número de seguidores, palavra na bio ou presença de link externo.\n5. Para baixar, clique em **Exportar CSV**.\n6. Para mandar para a base com telefone, clique em **Importar como contatos** — a bio vira **nota inicial**.",
        buttons: [
          { label: "Buscar por perfil", description: "Cole o @ ou URL do perfil e o sistema lista os seguidores públicos." },
          { label: "Buscar por post", description: "Cole a URL do post e o sistema lista quem comentou (com texto do comentário)." },
          { label: "Buscar por palavra-chave", description: "Encontra perfis cuja bio/nome contém o termo." },
          { label: "Resultados (tabela)", description: "Mostra @, nome, biografia, seguidores, link e (quando público) telefone/e-mail da bio." },
          { label: "Filtrar resultados", description: "Reduz a lista por número de seguidores, presença de palavra na bio, link externo etc." },
          { label: "Exportar CSV", description: "Baixa a lista para uso em outras ferramentas ou armazenamento." },
          { label: "Importar como contatos", description: "Manda os perfis com telefone direto para a base. Suporte para usar a bio como nota inicial." },
        ],
        tips: [
          "Use com responsabilidade — respeite as regras do Instagram e a LGPD/GDPR.",
          "Perfis sem telefone público não viram contato com WhatsApp — exporte para abordar por DM.",
        ],
      },
    ],
  },
  {
    id: "aquecimento",
    title: "Aquecimento de Chip",
    description: "Aumente a reputação de números novos antes de usar em campanhas.",
    steps: [
      {
        id: "aquecimento-1",
        title: "Como funciona o aquecimento",
        description:
          "Para aquecer um chip novo antes de campanhas:\n\n1. No menu lateral, clique em **Aquecimento**.\n2. Aperte **Iniciar aquecimento** — abre o assistente.\n3. Selecione as **Instâncias** que quer aquecer.\n4. Escolha a **Intensidade**: **Leve**, **Moderado** ou **Forte**.\n5. Defina a **Duração** em dias (recomendado **7 a 14 dias**).\n6. Em **Pool de contatos**, adicione números seguros (próprios ou parceiros) que vão receber mensagens.\n7. Em **Pares de aquecimento**, defina duplas de instâncias que conversam entre si.\n8. Ative **Gerar conteúdo IA** para variar saudações, perguntas e áudios curtos automaticamente.\n9. Aperte **Iniciar**. Acompanhe pelo **card de progresso** (dias, mensagens, taxa de entrega).\n10. Use **Pausar/Retomar** quando precisar e **Encerrar** quando terminar — o número fica liberado para campanhas.",
        buttons: [
          { label: "Iniciar aquecimento", description: "Abre o assistente: você escolhe quais instâncias aquecer, intensidade (leve/moderado/forte) e duração." },
          { label: "Pool de contatos", description: "Lista de números seguros (próprios ou parceiros) que recebem as mensagens. Você adiciona/remove aqui." },
          { label: "Pares de aquecimento", description: "Define duplas de instâncias que conversam entre si automaticamente." },
          { label: "Gerar conteúdo IA", description: "Cria assuntos e respostas variados (saudações, perguntas, áudios curtos) usando IA para parecer humano." },
          { label: "Progresso", description: "Card de cada instância mostra dias de aquecimento, mensagens trocadas, taxa de entrega." },
          { label: "Log de atividades", description: "Histórico minuto-a-minuto de quem mandou o quê para quem." },
          { label: "Pausar / Retomar", description: "Suspende o aquecimento sem perder o progresso acumulado." },
          { label: "Encerrar", description: "Finaliza definitivamente. O número fica disponível para campanhas." },
        ],
        tips: [
          "Aqueça por 7–14 dias antes do primeiro disparo grande. Pular essa etapa é o principal motivo de chips caírem.",
          "Misturar conversa com pool + pares dá um padrão mais natural.",
          "Não aqueça e dispare ao mesmo tempo — sobrecarrega o número.",
        ],
      },
    ],
  },
  {
    id: "analise",
    title: "Análise e Relatórios",
    description: "Acompanhe desempenho do time, das campanhas e do funil com gráficos e exportações.",
    steps: [
      {
        id: "analise-1",
        title: "Relatórios disponíveis",
        description:
          "Para consultar relatórios e indicadores:\n\n1. No menu lateral, clique em **Análise**.\n2. No topo, escolha o **Filtro de período** (**Hoje**, **7**, **30**, **90 dias** ou **personalizado**).\n3. (Gestores) Use **Filtro de atendente** para restringir a uma pessoa do time.\n4. (Opcional) Aplique **Filtro de instância** e **Filtro de funil** para fatiar os dados.\n5. Observe os **Cards de KPI**: conversas, tempo médio de resposta, taxa de resolução, leads convertidos.\n6. Analise o **Gráfico de mensagens por hora** para identificar horários de pico.\n7. Confira o **Score do atendente** — clique no nome para ver detalhamento por critério.\n8. Clique em qualquer card para abrir os **Detalhes do relatório**.\n9. Aperte **Exportar PDF** para gerar um documento de reunião ou **Exportar CSV** para análise externa.",
        buttons: [
          { label: "Filtro de período", description: "Hoje, 7/30/90 dias ou intervalo personalizado. Afeta todos os gráficos da tela." },
          { label: "Filtro de atendente", description: "Restringe os relatórios a uma pessoa do time (para gestores)." },
          { label: "Filtro de instância", description: "Mostra dados de um número específico de WhatsApp." },
          { label: "Filtro de funil", description: "Restringe métricas de conversão a um funil escolhido." },
          { label: "Cards de KPI", description: "Conversas, tempo médio de resposta, taxa de resolução, leads convertidos." },
          { label: "Gráfico de mensagens por hora", description: "Mostra horários de pico — útil para escalar equipe." },
          { label: "Score do atendente", description: "Nota composta (velocidade, volume, satisfação) com detalhamento por critério." },
          { label: "Detalhes do relatório", description: "Clique em um card para abrir a visão detalhada com lista de itens." },
          { label: "Exportar PDF", description: "Gera um PDF da tela atual com gráficos e tabelas — ideal para reuniões." },
          { label: "Exportar CSV", description: "Baixa os dados brutos para análises personalizadas em planilha." },
        ],
        tips: [
          "Use o score do atendente em reuniões semanais — destaque pontos fortes antes de cobrar pontos fracos.",
          "Compare períodos semelhantes (semana vs semana) em vez de períodos com sazonalidade diferente.",
        ],
      },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Acompanhe cobranças, integração com Asaas e gestão de devedores.",
    steps: [
      {
        id: "financeiro-1",
        title: "Visão geral financeira",
        description:
          "Para acompanhar cobranças integradas com o Asaas:\n\n1. No menu lateral, clique em **Financeiro**.\n2. No topo, ajuste o **Filtro de período** para escolher o intervalo.\n3. Observe os **Cards de KPI**: **Recebido no mês**, **A receber**, **Em atraso**, **Ticket médio**.\n4. Role até a **Lista de cobranças** — mostra cliente, valor, vencimento, status e método.\n5. Clique em uma cobrança para abrir **Detalhes** (histórico, link do boleto, comprovantes).\n6. Para enviar de novo, aperte **Reenviar cobrança** — dispara WhatsApp ou e-mail com link.\n7. Para forçar atualização de status, clique em **Sincronizar Asaas** (o sistema também sincroniza a cada **2 min**).\n8. Ative **Lembretes automáticos** para enviar avisos **5 dias antes**, **no dia** e **após atraso**.\n9. Para gerenciar inadimplentes, clique em **Devedores** no topo.",
        buttons: [
          { label: "Cards de KPI financeiros", description: "Recebido no mês, a receber, em atraso, ticket médio." },
          { label: "Filtro de período", description: "Define o intervalo das métricas e da listagem de cobranças." },
          { label: "Lista de cobranças", description: "Mostra cliente, valor, vencimento, status (pago, pendente, atrasado), método." },
          { label: "Detalhes da cobrança", description: "Clique para abrir histórico, link do boleto, comprovantes e ações." },
          { label: "Reenviar cobrança", description: "Dispara novamente o WhatsApp ou e-mail com o link de pagamento." },
          { label: "Sincronizar Asaas", description: "Força atualização do status (paga, atrasada). O sistema também sincroniza automaticamente a cada 2 min." },
          { label: "Lembretes automáticos", description: "Liga/desliga o envio de lembrete 5 dias antes do vencimento, no dia, e após atraso." },
          { label: "Devedores", description: "Atalho para a tela dedicada com clientes em atraso, valor acumulado e ações em massa." },
        ],
        tips: [
          "Mantenha o token do Asaas atualizado em Configurações > Integrações — sem ele a sincronização para.",
          "O lembrete usa o template oficial Meta com variáveis como {{vencimento}} e {{valor}}.",
        ],
      },
      {
        id: "financeiro-2",
        title: "Gestão de devedores",
        description:
          "Para agir sobre devedores em massa:\n\n1. Em **Financeiro**, clique no botão **Devedores** no topo.\n2. Use **Filtro por dias de atraso** para mostrar só quem está atrasado há mais/menos de N dias.\n3. Use **Filtro por valor** para focar em quem deve acima de um valor mínimo.\n4. Clique nos cabeçalhos **Valor** ou **Atraso** para reordenar a tabela.\n5. Antes de cobrar em massa, aperte **Sincronizar Asaas** para evitar cobrar quem já pagou.\n6. Marque os **checkboxes** dos devedores e use **Selecionar tudo** se quiser todos.\n7. Para cobrar todos de uma vez, clique em **Disparar campanha** — abre o assistente já com a lista preenchida.\n8. Para distribuir entre o time, aperte **Criar tarefas** — uma tarefa por devedor.\n9. Para negociar caso a caso, clique em **Abrir conversa** ao lado do contato (vai direto ao Inbox).\n10. Para baixar a lista, aperte **Exportar**.",
        buttons: [
          { label: "Filtro por dias de atraso", description: "Mostra só quem está atrasado há mais/menos de N dias." },
          { label: "Filtro por valor", description: "Restringe a inadimplentes acima de um valor mínimo." },
          { label: "Ordenar por valor / atraso", description: "Reorganiza a tabela para priorizar quem deve mais ou está há mais tempo." },
          { label: "Selecionar em massa", description: "Marca vários devedores para ações em lote (campanha, tarefa, etiqueta)." },
          { label: "Disparar campanha", description: "Cria uma campanha de cobrança já com a lista dos selecionados pré-preenchida." },
          { label: "Criar tarefas", description: "Gera uma tarefa de cobrança para cada devedor, distribuída entre o time." },
          { label: "Abrir conversa", description: "Vai direto para o Inbox no contato escolhido para negociar." },
          { label: "Exportar", description: "Baixa a lista de devedores em CSV." },
        ],
        tips: [
          "Antes de disparar cobrança em massa, sincronize com o Asaas para evitar cobrar quem já pagou.",
          "Combine campanha (texto inicial) + tarefas para o time (caso o cliente não responda em X dias).",
        ],
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks e Integrações",
    description: "Conecte com Make/n8n/Zapier para integrar com sistemas externos.",
    steps: [
      {
        id: "webhooks-1",
        title: "Criando uma integração",
        description:
          "Para conectar a plataforma com Make, n8n ou Zapier:\n\n1. No menu lateral, clique em **Webhooks**.\n2. Aperte **Nova conexão** — abrirá um **popup**.\n3. Digite um **Nome** para identificar a integração.\n4. Em **Eventos disponíveis**, marque os que quer enviar: **Nova mensagem**, **Mensagem enviada**, **Novo contato**, **Novo deal**, **Mudança de etapa**, **Tarefa criada**, **Campanha finalizada**.\n5. Em **URL de destino**, cole o endpoint do **Make/n8n/Zapier** que recebe via **POST JSON**.\n6. Aperte **Salvar conexão**.\n7. Clique em **Testar webhook** para disparar um evento de exemplo e validar o destino.\n8. Para receber dados de fora, copie a **URL de entrada** e use no sistema externo.\n9. Acompanhe pelos **Logs**: data, evento, status HTTP, tempo de resposta e payload.\n10. Use **Pausar/Ativar** quando precisar fazer manutenção sem excluir a conexão.",
        buttons: [
          { label: "Nova conexão", description: "Cria um webhook. Você dá um nome, escolhe os eventos e cola a URL de destino." },
          { label: "Eventos disponíveis", description: "Nova mensagem, mensagem enviada, novo contato, novo deal, mudança de etapa, tarefa criada, campanha finalizada etc." },
          { label: "URL de destino", description: "Endpoint do Make/n8n/Zapier que vai receber os eventos via POST com payload JSON." },
          { label: "Copiar URL de entrada", description: "Em integrações inversas, mostra a URL para receber dados de fora (criar contato, enviar mensagem)." },
          { label: "Documentação dos eventos", description: "Painel com exemplos de payload para cada evento — facilita configurar do outro lado." },
          { label: "Logs", description: "Histórico de envios: data, evento, status HTTP, tempo de resposta e payload enviado." },
          { label: "Testar webhook", description: "Dispara um evento de exemplo para validar que o destino está respondendo certo." },
          { label: "Pausar / Ativar", description: "Liga ou desliga sem precisar excluir. Útil em manutenção do sistema externo." },
        ],
        tips: [
          "Sempre teste com o evento real antes de colocar em produção — payloads podem variar entre eventos.",
          "Se o destino responder com erro 5xx, o sistema reagenda automaticamente algumas vezes.",
          "Use os logs para depurar — eles mostram exatamente o que foi enviado.",
        ],
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações gerais",
    description: "Integrações, campos personalizados, tokens de IA e plano da conta.",
    steps: [
      {
        id: "configuracoes-1",
        title: "Integrações externas",
        description:
          "Para conectar serviços externos à plataforma:\n\n1. Abra **Configurações** pelo avatar do topo.\n2. Vá na aba **Integrações**.\n3. Localize a integração desejada e clique em **Conectar**:\n  - **Google Calendar**: login Google para sincronizar agenda.\n  - **Meta (WhatsApp oficial)**: login Facebook para conectar números **Cloud API**.\n  - **Meta Messenger / Instagram**: login Facebook para receber DMs no Inbox.\n  - **Asaas**: cole o **token de API** do Asaas.\n  - **ElevenLabs**: cole a **chave de API** para gerar TTS.\n4. Siga o fluxo de **OAuth** ou cole o **token** conforme pedido.\n5. Aperte **Salvar conexão**.\n6. Quando expirar, aparece o aviso **Token expirado** — clique em **Reconectar** para refazer o login.\n7. Para remover, clique em **Desconectar** (dá para reconectar depois sem perder histórico).",
        buttons: [
          { label: "Google Calendar", description: "Conecta a agenda do Google para ver/editar eventos sincronizados no Calendário." },
          { label: "Meta (WhatsApp oficial)", description: "Login com Facebook para conectar números oficiais (Cloud API) — habilita disparo de templates em grande volume." },
          { label: "Meta Messenger / Instagram", description: "Conecta páginas do Facebook e contas do Instagram para receber DMs no Inbox." },
          { label: "Asaas", description: "Token de API do Asaas para sincronizar cobranças e disparar lembretes automáticos." },
          { label: "ElevenLabs (TTS)", description: "Chave de API para gerar áudios humanizados de templates." },
          { label: "Make / n8n / Zapier", description: "Atalho para a tela de Webhooks, onde você cria as conexões." },
          { label: "Reconectar", description: "Refaz o OAuth caso o token tenha expirado." },
          { label: "Desconectar", description: "Remove a integração. Pode reconectar depois sem perder o histórico." },
        ],
        tips: [
          "Tokens armazenados ficam criptografados — nem outros admins conseguem ver o valor.",
          "Sempre reconecte logo após ver o aviso de 'token expirado' — caso contrário, automações começam a falhar silenciosamente.",
        ],
      },
      {
        id: "configuracoes-2",
        title: "Tokens de IA e Plano",
        description:
          "A plataforma usa créditos (tokens) para chamadas de IA: respostas dos agentes, variações de templates, transcrições, geração de conteúdo no aquecimento. Em Configurações > Tokens de IA você vê o saldo, histórico de consumo e pode comprar pacotes adicionais. Em Assinatura você gerencia o plano da conta.",
        buttons: [
          { label: "Saldo de tokens", description: "Quantidade disponível agora. Recarrega no início de cada ciclo do plano." },
          { label: "Histórico de uso", description: "Tabela com cada chamada de IA: data, tipo (agente, template, transcrição), tokens consumidos." },
          { label: "Comprar pacote", description: "Adquire tokens avulsos sem mudar de plano. Útil em meses de pico." },
          { label: "Transferir tokens (admin)", description: "Distribui tokens entre organizações irmãs (em contas com várias empresas)." },
          { label: "Plano atual", description: "Em Assinatura, mostra o plano vigente, limites (instâncias, membros, mensagens) e renovação." },
          { label: "Alterar plano", description: "Upgrade ou downgrade. A cobrança proporcional é feita pelo Stripe." },
          { label: "Histórico de cobranças", description: "Lista todas as faturas, com link para o PDF e status (paga, pendente)." },
          { label: "Cancelar assinatura", description: "Encerra a renovação automática. O acesso continua até o fim do ciclo pago." },
        ],
        tips: [
          "Configure alerta de saldo baixo de tokens — assim você compra pacote antes do agente parar de responder.",
          "Mudar de plano não migra histórico — só limites passam a valer a partir do próximo ciclo.",
        ],
      },
    ],
  },
  {
    id: "formularios",
    title: "Formulários e Leads",
    description: "Capture leads com formulários personalizados que viram cartões no funil.",
    steps: [
      {
        id: "formularios-1",
        title: "Criando um formulário",
        description:
          "Em Formulários > Novo, você define o título, os campos (nome, telefone, e-mail, campos personalizados) e o funil de destino. Cada envio gera automaticamente um cartão no funil escolhido, já com os dados preenchidos. O link público pode ser compartilhado em qualquer canal (site, bio, anúncio, QR code).",
        image: "/training/formularios/01.png",
        buttons: [
          { label: "Título do formulário", description: "Nome interno e título exibido para o lead. Aparece também no cabeçalho da página pública." },
          { label: "Adicionar campo", description: "Insere um novo campo. Tipos disponíveis: texto, telefone, e-mail, número, data, hora, seleção, múltipla escolha." },
          { label: "Editar campo", description: "Lápis ao lado de cada campo. Permite mudar rótulo, tornar obrigatório, definir placeholder e opções." },
          { label: "Reordenar campos", description: "Arraste o ícone à esquerda do campo para mudar a ordem em que aparecem para o lead." },
          { label: "Excluir campo", description: "Lixeira ao lado de cada campo. Remove o campo do formulário (respostas antigas continuam preservadas)." },
          { label: "Funil de destino", description: "Define em qual funil e etapa o lead vai cair quando enviar o formulário." },
          { label: "Mensagem de sucesso", description: "Texto exibido ao lead depois que ele envia o formulário. Pode incluir agradecimento ou próximos passos." },
          { label: "Link público / Copiar", description: "URL única do formulário. Use o botão de copiar para colar em redes sociais, anúncios ou QR codes." },
          { label: "Publicar / Despublicar", description: "Liga ou desliga o formulário. Quando despublicado, o link mostra uma mensagem de indisponível." },
          { label: "Pré-visualizar", description: "Abre o formulário numa nova aba como o lead vai ver, sem gravar resposta." },
        ],
        tips: [
          "Mantenha o formulário curto (3 a 5 campos) — taxas de conversão caem muito a partir do 6º campo.",
          "O campo telefone é normalizado automaticamente (formato 55 + DDD + número).",
          "Se ativar 'criação automática de lead', cada envio já vira oportunidade no funil sem trabalho manual.",
        ],
      },
      {
        id: "formularios-2",
        title: "Compartilhando e acompanhando respostas",
        description:
          "Depois de publicado, cada formulário tem um link único e uma página de respostas. Você acompanha cada envio em tempo real, filtra por período e exporta tudo em CSV. Cada resposta também cria um cartão no funil escolhido — então fica fácil dar continuidade ao atendimento.",
        buttons: [
          { label: "Copiar link público", description: "Copia para área de transferência. Cole em bio, anúncios, QR code, e-mails." },
          { label: "Gerar QR Code", description: "Cria um QR para o link público — bom para folhetos e mesas de evento." },
          { label: "Pré-visualizar página pública", description: "Abre como o lead vê. Útil para revisar a aparência antes de divulgar." },
          { label: "Lista de respostas", description: "Tabela com cada envio: data, contato, valor de cada campo. Clica para abrir o cartão no funil." },
          { label: "Filtro de período", description: "Restringe a tabela a um intervalo (hoje, semana, mês, personalizado)." },
          { label: "Exportar respostas", description: "Baixa todas as respostas filtradas em CSV." },
          { label: "Estatísticas", description: "Mostra envios por dia, taxa de conclusão (se tiver várias etapas) e fontes de tráfego." },
          { label: "Editar formulário", description: "Atalho para voltar ao construtor e modificar campos ou aparência." },
        ],
        tips: [
          "Mudar campos depois de publicado não afeta respostas antigas, mas pode confundir relatórios — prefira criar uma versão nova.",
          "Use o filtro de período + exportação para acompanhar campanhas específicas (ex.: respostas dos 7 dias após um anúncio).",
        ],
      },
    ],
  },
];
