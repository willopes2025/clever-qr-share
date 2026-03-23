// Service to fetch and search CNAEs from IBGE API with in-memory cache

export interface CnaeItem {
  value: string;
  label: string;
}

let cachedCnaes: CnaeItem[] | null = null;
let fetchPromise: Promise<CnaeItem[]> | null = null;

const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const formatCnaeCode = (id: string): string => {
  // Format: 4774100 -> 4774-1/00
  if (id.length === 7) {
    return `${id.slice(0, 4)}-${id.slice(4, 5)}/${id.slice(5, 7)}`;
  }
  return id;
};

const titleCase = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/(^|\s|\/|-)\w/g, (match) => match.toUpperCase());
};

export const fetchAllCnaes = async (): Promise<CnaeItem[]> => {
  if (cachedCnaes) return cachedCnaes;
  
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const response = await fetch(
        'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses'
      );

      if (!response.ok) {
        throw new Error('Failed to fetch CNAEs from IBGE');
      }

      const data = await response.json();
      
      cachedCnaes = data.map((item: any) => {
        const code = formatCnaeCode(String(item.id));
        const desc = titleCase(item.descricao || '');
        return {
          value: String(item.id),
          label: `${code} - ${desc}`,
        };
      }).sort((a: CnaeItem, b: CnaeItem) => a.value.localeCompare(b.value));

      return cachedCnaes!;
    } catch (error) {
      console.error('Error fetching CNAEs:', error);
      fetchPromise = null;
      return [];
    }
  })();

  return fetchPromise;
};

export const searchCnaeDynamic = (cnaes: CnaeItem[], term: string, limit = 50): CnaeItem[] => {
  if (!term || term.length < 2) return cnaes.slice(0, 30);
  
  const normalized = normalizeText(term);
  const terms = normalized.split(/\s+/).filter(t => t.length > 0);
  
  return cnaes
    .filter(c => {
      const normalizedLabel = normalizeText(c.label);
      const normalizedValue = normalizeText(c.value);
      // All terms must match
      return terms.every(t => normalizedLabel.includes(t) || normalizedValue.includes(t));
    })
    .slice(0, limit);
};
