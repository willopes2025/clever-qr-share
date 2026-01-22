export const COUNTRY_CODES = [
  { code: "55", name: "Brasil", flag: "🇧🇷", mask: "(XX) XXXXX-XXXX" },
  { code: "1", name: "Estados Unidos", flag: "🇺🇸", mask: "(XXX) XXX-XXXX" },
  { code: "54", name: "Argentina", flag: "🇦🇷", mask: "XX XXXX-XXXX" },
  { code: "56", name: "Chile", flag: "🇨🇱", mask: "X XXXX XXXX" },
  { code: "57", name: "Colômbia", flag: "🇨🇴", mask: "XXX XXX XXXX" },
  { code: "51", name: "Peru", flag: "🇵🇪", mask: "XXX XXX XXX" },
  { code: "598", name: "Uruguai", flag: "🇺🇾", mask: "XX XXX XXX" },
  { code: "595", name: "Paraguai", flag: "🇵🇾", mask: "XXX XXXXXX" },
  { code: "591", name: "Bolívia", flag: "🇧🇴", mask: "X XXX XXXX" },
  { code: "58", name: "Venezuela", flag: "🇻🇪", mask: "XXX XXX XXXX" },
  { code: "593", name: "Equador", flag: "🇪🇨", mask: "XX XXX XXXX" },
  { code: "34", name: "Espanha", flag: "🇪🇸", mask: "XXX XXX XXX" },
  { code: "351", name: "Portugal", flag: "🇵🇹", mask: "XXX XXX XXX" },
  { code: "39", name: "Itália", flag: "🇮🇹", mask: "XXX XXX XXXX" },
  { code: "33", name: "França", flag: "🇫🇷", mask: "X XX XX XX XX" },
  { code: "49", name: "Alemanha", flag: "🇩🇪", mask: "XXXX XXXXXXX" },
  { code: "44", name: "Reino Unido", flag: "🇬🇧", mask: "XXXX XXXXXX" },
  { code: "81", name: "Japão", flag: "🇯🇵", mask: "XX XXXX XXXX" },
  { code: "86", name: "China", flag: "🇨🇳", mask: "XXX XXXX XXXX" },
  { code: "91", name: "Índia", flag: "🇮🇳", mask: "XXXXX XXXXX" },
  { code: "82", name: "Coreia do Sul", flag: "🇰🇷", mask: "XX XXXX XXXX" },
  { code: "52", name: "México", flag: "🇲🇽", mask: "XX XXXX XXXX" },
  { code: "61", name: "Austrália", flag: "🇦🇺", mask: "XXX XXX XXX" },
  { code: "27", name: "África do Sul", flag: "🇿🇦", mask: "XX XXX XXXX" },
  { code: "971", name: "Emirados Árabes", flag: "🇦🇪", mask: "XX XXX XXXX" },
  { code: "966", name: "Arábia Saudita", flag: "🇸🇦", mask: "XX XXX XXXX" },
  { code: "7", name: "Rússia", flag: "🇷🇺", mask: "XXX XXX XX XX" },
  { code: "380", name: "Ucrânia", flag: "🇺🇦", mask: "XX XXX XX XX" },
  { code: "48", name: "Polônia", flag: "🇵🇱", mask: "XXX XXX XXX" },
  { code: "31", name: "Holanda", flag: "🇳🇱", mask: "X XXXXXXXX" },
  { code: "32", name: "Bélgica", flag: "🇧🇪", mask: "XXX XX XX XX" },
  { code: "41", name: "Suíça", flag: "🇨🇭", mask: "XX XXX XX XX" },
  { code: "43", name: "Áustria", flag: "🇦🇹", mask: "XXXX XXXXXX" },
  { code: "46", name: "Suécia", flag: "🇸🇪", mask: "XX XXX XX XX" },
  { code: "47", name: "Noruega", flag: "🇳🇴", mask: "XXX XX XXX" },
  { code: "45", name: "Dinamarca", flag: "🇩🇰", mask: "XX XX XX XX" },
  { code: "358", name: "Finlândia", flag: "🇫🇮", mask: "XX XXX XXXX" },
  { code: "353", name: "Irlanda", flag: "🇮🇪", mask: "XX XXX XXXX" },
  { code: "30", name: "Grécia", flag: "🇬🇷", mask: "XXX XXX XXXX" },
  { code: "90", name: "Turquia", flag: "🇹🇷", mask: "XXX XXX XXXX" },
  { code: "972", name: "Israel", flag: "🇮🇱", mask: "XX XXX XXXX" },
  { code: "20", name: "Egito", flag: "🇪🇬", mask: "XX XXXX XXXX" },
  { code: "234", name: "Nigéria", flag: "🇳🇬", mask: "XXX XXX XXXX" },
  { code: "254", name: "Quênia", flag: "🇰🇪", mask: "XXX XXXXXX" },
  { code: "60", name: "Malásia", flag: "🇲🇾", mask: "XX XXX XXXX" },
  { code: "65", name: "Singapura", flag: "🇸🇬", mask: "XXXX XXXX" },
  { code: "66", name: "Tailândia", flag: "🇹🇭", mask: "XX XXX XXXX" },
  { code: "84", name: "Vietnã", flag: "🇻🇳", mask: "XX XXX XXXX" },
  { code: "63", name: "Filipinas", flag: "🇵🇭", mask: "XXX XXX XXXX" },
  { code: "62", name: "Indonésia", flag: "🇮🇩", mask: "XXX XXXX XXXX" },
  { code: "64", name: "Nova Zelândia", flag: "🇳🇿", mask: "XX XXX XXXX" },
] as const;

export const getCountryByCode = (code: string) => {
  return COUNTRY_CODES.find(c => c.code === code);
};

export const generateCountryOptionsHTML = (): string => {
  return COUNTRY_CODES.map(country => 
    `<option value="${country.code}" ${country.code === '55' ? 'selected' : ''}>
      ${country.flag} +${country.code}
    </option>`
  ).join('');
};
