/** Sans 0/O ni 1/I/L pour éviter les erreurs de lecture. */
export const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 6;

export function genererCode(aleatoire: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) {
    code += ALPHABET_CODE[Math.floor(aleatoire() * ALPHABET_CODE.length)];
  }
  return code;
}

export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function codeValide(code: string): boolean {
  return code.length === LONGUEUR_CODE && [...code].every((c) => ALPHABET_CODE.includes(c));
}

export function messageInvitation(nomMaison: string, code: string): string {
  return `Rejoins « ${nomMaison} » pour partager le frigo et la liste de courses ! Code d'invitation : ${code}`;
}
