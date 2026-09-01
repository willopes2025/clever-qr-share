/** Claims do JWT. O tenant vem daqui — nunca do corpo da requisição. */
export interface TokenPayload {
  sub: string;
  kind: 'user' | 'terminal';
  tenantId: string;
  tenantIds: string[];
  storeId?: string;
  terminalId?: string;
  permissions: string[];
  features: string[];
}

/**
 * `expiresIn` do jsonwebtoken aceita "15m" em tempo de execução, mas o tipo
 * publicado só admite um literal conhecido. Centralizamos a conversão aqui.
 */
export function expiresIn(value: string | undefined, fallback: string): number {
  return (value ?? fallback) as unknown as number;
}
