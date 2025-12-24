// Códigos oficiais da Tabela de Natureza Jurídica - Receita Federal/IBGE
// Formato: código sem hífen (ex: 322-0 → 3220)
export const NATUREZA_JURIDICA = [
  // 1xx-x - Administração Pública
  { value: "1015", label: "101-5 - Órgão Público do Poder Executivo Federal" },
  { value: "1023", label: "102-3 - Órgão Público do Poder Executivo Estadual ou do Distrito Federal" },
  { value: "1031", label: "103-1 - Órgão Público do Poder Executivo Municipal" },
  { value: "1040", label: "104-0 - Órgão Público do Poder Legislativo Federal" },
  { value: "1058", label: "105-8 - Órgão Público do Poder Legislativo Estadual ou do Distrito Federal" },
  { value: "1066", label: "106-6 - Órgão Público do Poder Legislativo Municipal" },
  { value: "1074", label: "107-4 - Órgão Público do Poder Judiciário Federal" },
  { value: "1082", label: "108-2 - Órgão Público do Poder Judiciário Estadual" },
  { value: "1104", label: "110-4 - Autarquia Federal" },
  { value: "1112", label: "111-2 - Autarquia Estadual ou do Distrito Federal" },
  { value: "1120", label: "112-0 - Autarquia Municipal" },
  { value: "1139", label: "113-9 - Fundação Pública de Direito Público Federal" },
  { value: "1147", label: "114-7 - Fundação Pública de Direito Público Estadual ou do Distrito Federal" },
  { value: "1155", label: "115-5 - Fundação Pública de Direito Público Municipal" },
  { value: "1163", label: "116-3 - Órgão Público Autônomo Federal" },
  { value: "1171", label: "117-1 - Órgão Público Autônomo Estadual ou do Distrito Federal" },
  { value: "1180", label: "118-0 - Órgão Público Autônomo Municipal" },
  { value: "1198", label: "119-8 - Comissão Polinacional" },
  { value: "1210", label: "121-0 - Consórcio Público de Direito Público (Associação Pública)" },
  { value: "1228", label: "122-8 - Consórcio Público de Direito Privado" },
  { value: "1236", label: "123-6 - Estado ou Distrito Federal" },
  { value: "1244", label: "124-4 - Município" },
  { value: "1252", label: "125-2 - Fundação Pública de Direito Privado Federal" },
  { value: "1260", label: "126-0 - Fundação Pública de Direito Privado Estadual ou do Distrito Federal" },
  { value: "1279", label: "127-9 - Fundação Pública de Direito Privado Municipal" },

  // 2xx-x - Entidades Empresariais
  { value: "2011", label: "201-1 - Empresa Pública" },
  { value: "2038", label: "203-8 - Sociedade de Economia Mista" },
  { value: "2046", label: "204-6 - Sociedade Anônima Aberta" },
  { value: "2054", label: "205-4 - Sociedade Anônima Fechada" },
  { value: "2062", label: "206-2 - Sociedade Empresária Limitada" },
  { value: "2070", label: "207-0 - Sociedade Empresária em Nome Coletivo" },
  { value: "2089", label: "208-9 - Sociedade Empresária em Comandita Simples" },
  { value: "2097", label: "209-7 - Sociedade Empresária em Comandita por Ações" },
  { value: "2100", label: "210-0 - Sociedade em Conta de Participação" },
  { value: "2127", label: "212-7 - Sociedade Unipessoal de Advocacia" },
  { value: "2135", label: "213-5 - Cooperativa" },
  { value: "2143", label: "214-3 - Consórcio de Sociedades" },
  { value: "2151", label: "215-1 - Grupo de Sociedades" },
  { value: "2160", label: "216-0 - Estabelecimento, no Brasil, de Sociedade Estrangeira" },
  { value: "2178", label: "217-8 - Estabelecimento, no Brasil, de Empresa Binacional Argentino-Brasileira" },
  { value: "2194", label: "219-4 - Empresa Domiciliada no Exterior" },
  { value: "2216", label: "221-6 - Clube/Fundo de Investimento" },
  { value: "2224", label: "222-4 - Sociedade Simples Pura" },
  { value: "2232", label: "223-2 - Sociedade Simples Limitada" },
  { value: "2240", label: "224-0 - Sociedade Simples em Nome Coletivo" },
  { value: "2259", label: "225-9 - Sociedade Simples em Comandita Simples" },
  { value: "2267", label: "226-7 - Empresa Binacional" },
  { value: "2275", label: "227-5 - Consórcio de Empregadores" },
  { value: "2283", label: "228-3 - Consórcio Simples" },
  { value: "2291", label: "229-1 - Eireli - Empresa Individual de Responsabilidade Limitada" },
  { value: "2305", label: "230-5 - Cooperativa de Consumo" },
  { value: "2313", label: "231-3 - Sociedade Limitada Unipessoal" },
  { value: "2321", label: "232-1 - Empresa Simples de Inovação - Inova Simples" },

  // Empresário Individual
  { value: "2135", label: "213-5 - Empresário (Individual)" },

  // 3xx-x - Entidades sem Fins Lucrativos
  { value: "3034", label: "303-4 - Serviço Notarial e Registral (Cartório)" },
  { value: "3069", label: "306-9 - Fundação Privada" },
  { value: "3077", label: "307-7 - Serviço Social Autônomo" },
  { value: "3085", label: "308-5 - Condomínio Edilício" },
  { value: "3107", label: "310-7 - Comissão de Conciliação Prévia" },
  { value: "3115", label: "311-5 - Entidade de Mediação e Arbitragem" },
  { value: "3131", label: "313-1 - Entidade Sindical" },
  { value: "3204", label: "320-4 - Estabelecimento, no Brasil, de Fundação ou Associação Estrangeiras" },
  { value: "3212", label: "321-2 - Fundação ou Associação Domiciliada no Exterior" },
  { value: "3220", label: "322-0 - Organização Religiosa" },
  { value: "3239", label: "323-9 - Comunidade Indígena" },
  { value: "3247", label: "324-7 - Fundo Privado" },
  { value: "3255", label: "325-5 - Órgão de Direção Nacional de Partido Político" },
  { value: "3263", label: "326-3 - Órgão de Direção Regional de Partido Político" },
  { value: "3271", label: "327-1 - Órgão de Direção Local de Partido Político" },
  { value: "3301", label: "330-1 - Organização Social (OS)" },
  { value: "3310", label: "331-0 - Demais Condomínios" },
  { value: "3999", label: "399-9 - Associação Privada" },

  // 4xx-x - Pessoas Físicas
  { value: "4014", label: "401-4 - Empresa Individual Imobiliária" },
  { value: "4022", label: "402-2 - Segurado Especial" },
  { value: "4081", label: "408-1 - Contribuinte Individual" },
  { value: "4090", label: "409-0 - Candidato a Cargo Político Eletivo" },
  { value: "4103", label: "410-3 - Leiloeiro" },
  { value: "4111", label: "411-1 - Produtor Rural (Pessoa Física)" },

  // 5xx-x - Organizações Internacionais e Outras
  { value: "5010", label: "501-0 - Organização Internacional" },
  { value: "5029", label: "502-9 - Representação Diplomática Estrangeira" },
  { value: "5037", label: "503-7 - Outras Instituições Extraterritoriais" },
] as const;

export const searchNaturezaJuridica = (term: string) => {
  const normalized = term.toLowerCase();
  return NATUREZA_JURIDICA.filter(
    n => n.value.includes(normalized) || n.label.toLowerCase().includes(normalized)
  );
};
