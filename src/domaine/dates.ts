export type EtatPeremption = 'depassee' | 'proche' | 'ok';

const JOUR = 24 * 60 * 60 * 1000;

/** AAAA-MM-JJ en heure locale. */
export function versDateISO(date: Date): string {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const j = String(date.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

export function estDateISO(texte: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const [a, m, j] = texte.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j;
}

/** Accepte « JJ/MM/AAAA », « JJ/MM/AA » ou « AAAA-MM-JJ ». */
export function lireDateSaisie(texte: string): string | null {
  const t = texte.trim();
  if (!t) return null;
  if (estDateISO(t)) return t;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const annee = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${annee}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return estDateISO(iso) ? iso : null;
}

export function formaterDateCourte(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

function joursEntre(debutISO: string, finISO: string): number {
  const [a1, m1, j1] = debutISO.split('-').map(Number);
  const [a2, m2, j2] = finISO.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / JOUR);
}

/** Rouge si dépassée, orange à moins de 3 jours, neutre sinon. */
export function etatPeremption(datePeremption: string | null, aujourdHui: Date = new Date()): EtatPeremption | null {
  if (!datePeremption) return null;
  const restant = joursEntre(versDateISO(aujourdHui), datePeremption);
  if (restant < 0) return 'depassee';
  if (restant < 3) return 'proche';
  return 'ok';
}

export function libellePeremption(datePeremption: string, aujourdHui: Date = new Date()): string {
  const restant = joursEntre(versDateISO(aujourdHui), datePeremption);
  if (restant < -1) return `Périmé depuis ${-restant} jours`;
  if (restant === -1) return 'Périmé depuis hier';
  if (restant === 0) return "Périme aujourd'hui";
  if (restant === 1) return 'Périme demain';
  return `Périme le ${formaterDateCourte(datePeremption)}`;
}

/** « il y a 2 jours », « à l'instant »… */
export function ilYA(horodatage: number | null, maintenant: number = Date.now()): string {
  if (horodatage == null) return "à l'instant";
  const secondes = Math.max(0, Math.round((maintenant - horodatage) / 1000));
  if (secondes < 60) return "à l'instant";
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours === 1) return 'hier';
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.round(jours / 30);
  if (mois < 12) return `il y a ${mois} mois`;
  const ans = Math.round(jours / 365);
  return `il y a ${ans} an${ans > 1 ? 's' : ''}`;
}
