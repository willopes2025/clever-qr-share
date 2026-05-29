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
    description: "Conheça a plataforma e configure seu acesso.",
    steps: [
      {
        id: "inicio-1",
        title: "Acessando o painel",
        description:
          "Depois de fazer login você cai direto no Dashboard. Ele reúne, em uma só tela, o resumo das suas conversas, das campanhas em andamento, das tarefas do dia e dos leads em cada etapa do funil. Use o menu lateral à esquerda para navegar entre os módulos da plataforma e o topo da tela para alternar de organização e acessar o seu perfil.",
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
          "Em Configurações > Perfil você ajusta seus dados pessoais e as preferências que afetam toda a plataforma. O fuso horário é especialmente importante porque é usado em campanhas agendadas, automações, relatórios e horários de atendimento.",
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
          "Cada número de WhatsApp conectado à plataforma é chamado de instância. Em Instâncias você vê a lista de todos os números, com o status atual (conectado, desconectado, aguardando QR) e as ações para gerenciar cada um. Para começar a conversar, você precisa criar pelo menos uma instância e conectá-la via QR Code.",
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
          "Quando você clica em Conectar, abre o modal com o QR Code. No seu celular, abra o WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho e aponte a câmera para o QR mostrado na tela. Se o QR expirar, basta atualizá-lo.",
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
          "O Inbox é dividido em três áreas: à esquerda você vê a lista de conversas (com filtros e busca), no centro o histórico da conversa selecionada e à direita o painel de detalhes do contato (com etiquetas, funil, notas e campos personalizados). Tudo é atualizado em tempo real conforme novas mensagens chegam.",
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
          "Na parte inferior da conversa você tem o campo de digitação e os botões de mídia. Além de texto, você pode enviar imagens, vídeos, documentos, áudios e templates oficiais. Use o agendamento para programar uma mensagem para depois.",
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
          "Em Disparos > Nova Campanha você monta o envio passo a passo: escolhe a(s) instância(s), o template ou mensagem livre, a lista de contatos e as configurações de ritmo (intervalo entre mensagens, janela de horário, agendamento). Quanto mais devagar, menor o risco de bloqueio do chip.",
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
          { label: "Salvar rascunho", description: "Salva a campanha sem começar a enviar — útil para revisar antes." },
          { label: "Iniciar campanha", description: "Confirma e coloca a campanha na fila de envio respeitando as regras configuradas." },
        ],
        tips: [
          "Em números oficiais (Meta), só é possível disparar templates aprovados. Em Evolution, mensagem livre é permitida.",
          "Sempre teste a campanha em uma lista pequena (5–10 contatos) antes do envio em massa.",
          "Variáveis com nome em branco caem para um espaço ' ' por padrão, evitando 'Olá ,'.",
        ],
      },
      {
        id: "campanhas-2",
        title: "Acompanhando o envio",
        description:
          "Depois de iniciada, a campanha mostra em tempo real quantas mensagens foram enviadas, entregues, lidas e falharam. Você pode pausar, retomar, cancelar ou exportar o resultado a qualquer momento.",
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
    ],
  },
];
