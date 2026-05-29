// Conteúdo dos treinamentos.
// Para adicionar uma nova etapa, coloque a imagem em /public/training/<modulo>/<etapa>.png
// e adicione um novo objeto em `steps` abaixo.

export type TrainingStep = {
  id: string; // ID único e estável (não mude depois de publicado)
  title: string;
  description: string;
  image?: string; // caminho público, ex: "/training/inbox/01.png"
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
          "Após o login você cai no Dashboard, que mostra um resumo das suas conversas, campanhas e tarefas. Use o menu lateral para navegar entre os módulos.",
        image: "/training/inicio/01.png",
      },
      {
        id: "inicio-2",
        title: "Configurando seu perfil",
        description:
          "Em Configurações > Perfil você ajusta nome, foto e fuso horário. O fuso é usado em campanhas e agendamentos.",
        image: "/training/inicio/02.png",
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
          "Vá em Instâncias > Nova Instância, dê um nome e clique em Criar. Você poderá conectar via QR Code logo em seguida.",
        image: "/training/instancias/01.png",
      },
      {
        id: "instancias-2",
        title: "Escaneando o QR Code",
        description:
          "No seu celular, abra WhatsApp > Aparelhos conectados > Conectar um aparelho e aponte para o QR Code da tela.",
        image: "/training/instancias/02.png",
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
          "À esquerda você vê a lista de conversas, no centro o histórico de mensagens e à direita os dados do contato.",
        image: "/training/inbox/01.png",
      },
      {
        id: "inbox-2",
        title: "Enviando mensagens e mídias",
        description:
          "Clique no clipe para anexar imagens, áudios ou documentos. Áudios devem ser .ogg para serem reconhecidos como mensagem de voz.",
        image: "/training/inbox/02.png",
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
          "Em Disparos > Nova Campanha, escolha a instância, o template e a lista de contatos. Configure intervalos para evitar bloqueios.",
        image: "/training/campanhas/01.png",
      },
      {
        id: "campanhas-2",
        title: "Acompanhando o envio",
        description:
          "Após iniciar, a campanha mostra em tempo real quantas mensagens foram enviadas, entregues e lidas.",
        image: "/training/campanhas/02.png",
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
          "Em Formulários > Novo, defina título, campos e o funil de destino. O link público pode ser compartilhado em qualquer canal.",
        image: "/training/formularios/01.png",
      },
      {
        id: "formularios-2",
        title: "Vendo respostas",
        description:
          "Cada envio aparece em Respostas. Você pode editar dados ou excluir a resposta — o cartão do lead é atualizado automaticamente.",
        image: "/training/formularios/02.png",
      },
    ],
  },
];
