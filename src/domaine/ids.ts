const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Identifiant aléatoire de 20 caractères, au même format que les anciens ids
 * Firestore. Tiré par l'app : un document créé hors ligne a tout de suite son id.
 */
export function nouvelId(): string {
  const octets = new Uint8Array(20);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(octets);
  else for (let i = 0; i < octets.length; i++) octets[i] = Math.floor(Math.random() * 256);
  let id = '';
  for (const o of octets) id += ALPHABET[o % ALPHABET.length];
  return id;
}
