// Service to fetch districts from IBGE API

interface IbgeDistrito {
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

export const fetchDistritosByUf = async (uf: string): Promise<string[]> => {
  if (cache[uf]) {
    return cache[uf];
  }

  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/distritos?orderBy=nome`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch districts for ${uf}`);
    }

    const data: IbgeDistrito[] = await response.json();
    const distritos = data.map((d) => d.nome.toUpperCase());

    cache[uf] = distritos;

    return distritos;
  } catch (error) {
    console.error(`Error fetching districts for ${uf}:`, error);
    return [];
  }
};

export const fetchDistritosForMultipleUfs = async (ufs: string[]): Promise<string[]> => {
  if (ufs.length === 0) return [];

  const results = await Promise.all(ufs.map((uf) => fetchDistritosByUf(uf)));

  const allDistritos = results.flat();
  return [...new Set(allDistritos)].sort();
};

export const searchDistritosInList = (
  distritos: string[],
  searchTerm: string,
  limit: number = 50
): string[] => {
  if (!searchTerm || searchTerm.length < 2) return [];

  const normalizedSearch = normalizeText(searchTerm);

  return distritos
    .filter((d) => normalizeText(d).includes(normalizedSearch))
    .slice(0, limit);
};
