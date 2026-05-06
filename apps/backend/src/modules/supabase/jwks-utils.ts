import { importJWK, JWK } from 'jose';

export async function importJWKS(jwk: Record<string, unknown>): Promise<unknown> {
  return importJWK(jwk as unknown as JWK, 'RS256');
}
