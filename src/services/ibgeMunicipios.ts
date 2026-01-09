// Service to fetch municipalities from IBGE API

interface IbgeMunicipio {
  id: number;
  nome: string;
}

// In-memory cache
const cache: Record<string, string[]> = {};

// Normalize text for search (remove accents, uppercase)
export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
};

export const fetchMunicipiosByUf = async (uf: string): Promise<string[]> => {
  // Check cache first
  if (cache[uf]) {
    return cache[uf];
  }

  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch municipalities for ${uf}`);
    }

    const data: IbgeMunicipio[] = await response.json();
    const municipios = data.map((m) => m.nome.toUpperCase());
    
    // Store in cache
    cache[uf] = municipios;
    
    return municipios;
  } catch (error) {
    console.error(`Error fetching municipalities for ${uf}:`, error);
    return [];
  }
};

export const fetchMunicipiosForMultipleUfs = async (ufs: string[]): Promise<string[]> => {
  if (ufs.length === 0) return [];

  const results = await Promise.all(ufs.map((uf) => fetchMunicipiosByUf(uf)));
  
  // Flatten and dedupe
  const allMunicipios = results.flat();
  return [...new Set(allMunicipios)].sort();
};

export const searchMunicipiosInList = (
  municipios: string[],
  searchTerm: string,
  limit: number = 50
): string[] => {
  if (!searchTerm || searchTerm.length < 2) return [];
  
  const normalizedSearch = normalizeText(searchTerm);
  
  return municipios
    .filter((m) => normalizeText(m).includes(normalizedSearch))
    .slice(0, limit);
};
