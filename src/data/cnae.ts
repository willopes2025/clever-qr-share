// Principais CNAEs por categoria
export const CNAE_LIST = [
  // Tecnologia
  { value: "6201501", label: "6201-5/01 - Desenvolvimento de programas de computador sob encomenda" },
  { value: "6202300", label: "6202-3/00 - Desenvolvimento e licenciamento de programas de computador customizáveis" },
  { value: "6203100", label: "6203-1/00 - Desenvolvimento e licenciamento de programas de computador não-customizáveis" },
  { value: "6204000", label: "6204-0/00 - Consultoria em tecnologia da informação" },
  { value: "6209100", label: "6209-1/00 - Suporte técnico, manutenção e outros serviços em TI" },
  { value: "6311900", label: "6311-9/00 - Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet" },
  { value: "6319400", label: "6319-4/00 - Portais, provedores de conteúdo e outros serviços de informação na internet" },
  
  // Comércio
  { value: "4711301", label: "4711-3/01 - Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados" },
  { value: "4711302", label: "4711-3/02 - Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados" },
  { value: "4712100", label: "4712-1/00 - Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - minimercados" },
  { value: "4751201", label: "4751-2/01 - Comércio varejista especializado de equipamentos e suprimentos de informática" },
  { value: "4753900", label: "4753-9/00 - Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo" },
  { value: "4781400", label: "4781-4/00 - Comércio varejista de artigos do vestuário e acessórios" },
  { value: "4789099", label: "4789-0/99 - Comércio varejista de outros produtos não especificados anteriormente" },
  
  // Alimentação
  { value: "5611201", label: "5611-2/01 - Restaurantes e similares" },
  { value: "5611203", label: "5611-2/03 - Lanchonetes, casas de chá, de sucos e similares" },
  { value: "5611204", label: "5611-2/04 - Bares e outros estabelecimentos especializados em servir bebidas" },
  { value: "5612100", label: "5612-1/00 - Serviços ambulantes de alimentação" },
  { value: "5620101", label: "5620-1/01 - Fornecimento de alimentos preparados preponderantemente para empresas" },
  { value: "5620104", label: "5620-1/04 - Fornecimento de alimentos preparados preponderantemente para consumo domiciliar" },
  
  // Saúde
  { value: "8610101", label: "8610-1/01 - Atividades de atendimento hospitalar" },
  { value: "8630501", label: "8630-5/01 - Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos" },
  { value: "8630502", label: "8630-5/02 - Atividade médica ambulatorial com recursos para realização de exames complementares" },
  { value: "8630503", label: "8630-5/03 - Atividade médica ambulatorial restrita a consultas" },
  { value: "8630504", label: "8630-5/04 - Atividade odontológica" },
  { value: "8650001", label: "8650-0/01 - Atividades de enfermagem" },
  { value: "8650002", label: "8650-0/02 - Atividades de profissionais da nutrição" },
  { value: "8650003", label: "8650-0/03 - Atividades de psicologia e psicanálise" },
  { value: "8650004", label: "8650-0/04 - Atividades de fisioterapia" },
  
  // Construção
  { value: "4120400", label: "4120-4/00 - Construção de edifícios" },
  { value: "4211101", label: "4211-1/01 - Construção de rodovias e ferrovias" },
  { value: "4221901", label: "4221-9/01 - Construção de barragens e represas para geração de energia elétrica" },
  { value: "4291000", label: "4291-0/00 - Obras portuárias, marítimas e fluviais" },
  { value: "4299501", label: "4299-5/01 - Construção de instalações esportivas e recreativas" },
  { value: "4313400", label: "4313-4/00 - Obras de terraplenagem" },
  { value: "4322301", label: "4322-3/01 - Instalações hidráulicas, sanitárias e de gás" },
  { value: "4321500", label: "4321-5/00 - Instalação e manutenção elétrica" },
  { value: "4330401", label: "4330-4/01 - Impermeabilização em obras de engenharia civil" },
  { value: "4330402", label: "4330-4/02 - Instalação de portas, janelas, tetos, divisórias e armários embutidos de qualquer material" },
  { value: "4330403", label: "4330-4/03 - Obras de acabamento em gesso e estuque" },
  { value: "4330404", label: "4330-4/04 - Serviços de pintura de edifícios em geral" },
  { value: "4330499", label: "4330-4/99 - Outras obras de acabamento da construção" },
  
  // Serviços Profissionais
  { value: "6911701", label: "6911-7/01 - Serviços advocatícios" },
  { value: "6911703", label: "6911-7/03 - Agente de propriedade industrial" },
  { value: "6920601", label: "6920-6/01 - Atividades de contabilidade" },
  { value: "6920602", label: "6920-6/02 - Atividades de consultoria e auditoria contábil e tributária" },
  { value: "7020400", label: "7020-4/00 - Atividades de consultoria em gestão empresarial" },
  { value: "7111100", label: "7111-1/00 - Serviços de arquitetura" },
  { value: "7112000", label: "7112-0/00 - Serviços de engenharia" },
  { value: "7319002", label: "7319-0/02 - Promoção de vendas" },
  { value: "7319003", label: "7319-0/03 - Marketing direto" },
  { value: "7319004", label: "7319-0/04 - Consultoria em publicidade" },
  { value: "7311400", label: "7311-4/00 - Agências de publicidade" },
  
  // Educação
  { value: "8511200", label: "8511-2/00 - Educação infantil - creche" },
  { value: "8512100", label: "8512-1/00 - Educação infantil - pré-escola" },
  { value: "8513900", label: "8513-9/00 - Ensino fundamental" },
  { value: "8520100", label: "8520-1/00 - Ensino médio" },
  { value: "8531700", label: "8531-7/00 - Educação superior - graduação" },
  { value: "8532500", label: "8532-5/00 - Educação superior - pós-graduação e extensão" },
  { value: "8591100", label: "8591-1/00 - Ensino de esportes" },
  { value: "8592901", label: "8592-9/01 - Ensino de dança" },
  { value: "8592902", label: "8592-9/02 - Ensino de artes cênicas, exceto dança" },
  { value: "8592903", label: "8592-9/03 - Ensino de música" },
  { value: "8593700", label: "8593-7/00 - Ensino de idiomas" },
  { value: "8599601", label: "8599-6/01 - Formação de condutores" },
  { value: "8599603", label: "8599-6/03 - Treinamento em informática" },
  { value: "8599604", label: "8599-6/04 - Treinamento em desenvolvimento profissional e gerencial" },
  { value: "8599699", label: "8599-6/99 - Outras atividades de ensino não especificadas anteriormente" },
  
  // Transporte e Logística
  { value: "4911600", label: "4911-6/00 - Transporte ferroviário de carga" },
  { value: "4921301", label: "4921-3/01 - Transporte rodoviário coletivo de passageiros, com itinerário fixo, municipal" },
  { value: "4930202", label: "4930-2/02 - Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal" },
  { value: "4930203", label: "4930-2/03 - Transporte rodoviário de carga, exceto produtos perigosos e mudanças, interestadual" },
  { value: "5211701", label: "5211-7/01 - Armazéns gerais - emissão de warrant" },
  { value: "5212500", label: "5212-5/00 - Carga e descarga" },
  { value: "5250801", label: "5250-8/01 - Comissaria de despachos" },
  { value: "5250802", label: "5250-8/02 - Atividades de despachantes aduaneiros" },
  { value: "5250803", label: "5250-8/03 - Agenciamento de cargas" },
  { value: "5250804", label: "5250-8/04 - Organização logística do transporte de carga" },
  { value: "5250805", label: "5250-8/05 - Operador de transporte multimodal (OTM)" },
  
  // Beleza e Estética
  { value: "9602501", label: "9602-5/01 - Cabeleireiros, manicure e pedicure" },
  { value: "9602502", label: "9602-5/02 - Atividades de estética e outros serviços de cuidados com a beleza" },
  
  // Imobiliário
  { value: "6810201", label: "6810-2/01 - Compra e venda de imóveis próprios" },
  { value: "6810202", label: "6810-2/02 - Aluguel de imóveis próprios" },
  { value: "6821801", label: "6821-8/01 - Corretagem na compra e venda e avaliação de imóveis" },
  { value: "6821802", label: "6821-8/02 - Corretagem no aluguel de imóveis" },
  { value: "6822600", label: "6822-6/00 - Gestão e administração da propriedade imobiliária" },
  
  // Indústria
  { value: "1091102", label: "1091-1/02 - Fabricação de produtos de padaria e confeitaria com predominância de produção própria" },
  { value: "1412601", label: "1412-6/01 - Confecção de peças do vestuário, exceto roupas íntimas e as confeccionadas sob medida" },
  { value: "2512800", label: "2512-8/00 - Fabricação de esquadrias de metal" },
  { value: "2542000", label: "2542-0/00 - Fabricação de artigos de serralheria, exceto esquadrias" },
  { value: "3101200", label: "3101-2/00 - Fabricação de móveis com predominância de madeira" },
  { value: "3102100", label: "3102-1/00 - Fabricação de móveis com predominância de metal" },
  
  // Agropecuária
  { value: "0111301", label: "0111-3/01 - Cultivo de arroz" },
  { value: "0111302", label: "0111-3/02 - Cultivo de milho" },
  { value: "0115600", label: "0115-6/00 - Cultivo de soja" },
  { value: "0151201", label: "0151-2/01 - Criação de bovinos para corte" },
  { value: "0151202", label: "0151-2/02 - Criação de bovinos para leite" },
  { value: "0155501", label: "0155-5/01 - Criação de frangos para corte" },
  { value: "0155502", label: "0155-5/02 - Produção de ovos" },
  { value: "0161001", label: "0161-0/01 - Serviço de pulverização e controle de pragas agrícolas" },
  { value: "0161002", label: "0161-0/02 - Serviço de poda de árvores para lavouras" },
  { value: "0161003", label: "0161-0/03 - Serviço de preparação de terreno, cultivo e colheita" },
  
  // Financeiro
  { value: "6422100", label: "6422-1/00 - Bancos múltiplos, com carteira comercial" },
  { value: "6435201", label: "6435-2/01 - Sociedades de crédito imobiliário" },
  { value: "6435202", label: "6435-2/02 - Associações de poupança e empréstimo" },
  { value: "6435203", label: "6435-2/03 - Companhias hipotecárias" },
  { value: "6436100", label: "6436-1/00 - Sociedades de crédito, financiamento e investimento - financeiras" },
  { value: "6438701", label: "6438-7/01 - Bancos de câmbio" },
  { value: "6438799", label: "6438-7/99 - Outras instituições de intermediação não-monetária" },
  { value: "6462000", label: "6462-0/00 - Holdings de instituições não-financeiras" },
  { value: "6463800", label: "6463-8/00 - Outras sociedades de participação, exceto holdings" },
  { value: "6470101", label: "6470-1/01 - Fundos de investimento, exceto previdenciários e imobiliários" },
  { value: "6470102", label: "6470-1/02 - Fundos de investimento previdenciários" },
  { value: "6470103", label: "6470-1/03 - Fundos de investimento imobiliários" },
] as const;

export const searchCnae = (term: string) => {
  const normalized = term.toLowerCase();
  return CNAE_LIST.filter(
    c => c.value.includes(normalized) || c.label.toLowerCase().includes(normalized)
  ).slice(0, 50); // Limit results
};
