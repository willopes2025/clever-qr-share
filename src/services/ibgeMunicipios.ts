// Service to fetch municipalities from IBGE API

interface IbgeMunicipio {
  id: number;
  nome: string;
}

const VALID_UFS = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
]);

const MAX_CACHE_ENTRIES = 30;
const cacheKeys: string[] = [];
const cache: Record<string, string[]> = {};

// Normalize text for search (remove accents, uppercase)
export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
};

const addToCache = (uf: string, municipios: string[]) => {
  if (cacheKeys.length >= MAX_CACHE_ENTRIES) {
    const evicted = cacheKeys.shift()!;
    delete cache[evicted];
  }
  cache[uf] = municipios;
  cacheKeys.push(uf);
};

export const fetchMunicipiosByUf = async (uf: string): Promise<string[]> => {
  const normalizedUf = uf.toUpperCase().trim();

  if (!VALID_UFS.has(normalizedUf)) {
    console.warn(`Invalid UF code: ${uf}`);
    return [];
  }

  if (cache[normalizedUf]) {
    return cache[normalizedUf];
  }

  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedUf}/municipios?orderBy=nome`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch municipalities for ${normalizedUf}`);
    }

    const data: IbgeMunicipio[] = await response.json();
    const municipios = data.map((m) => m.nome.toUpperCase());

    addToCache(normalizedUf, municipios);

    return municipios;
  } catch (error) {
    console.error(`Error fetching municipalities for ${normalizedUf}:`, error);
    return [];
  }
};

const CONCURRENCY_LIMIT = 5;

export const fetchMunicipiosForMultipleUfs = async (ufs: string[]): Promise<string[]> => {
  if (ufs.length === 0) return [];

  const results: string[][] = [];
  for (let i = 0; i < ufs.length; i += CONCURRENCY_LIMIT) {
    const batch = ufs.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(batch.map((uf) => fetchMunicipiosByUf(uf)));
    results.push(...batchResults);
  }

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
