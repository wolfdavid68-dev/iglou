import type { TriCourses } from '@/domaine/courses';

import { stockage } from './stockage';

const CLE_TRI = 'tri-courses';

/** Choix mémorisé sur ce téléphone : par appareil (défaut) ou par rayon. */
export function triCoursesEnregistre(): TriCourses {
  return stockage.lire(CLE_TRI) === 'rayon' ? 'rayon' : 'appareil';
}

export function choisirTriCourses(tri: TriCourses) {
  if (tri === 'appareil') stockage.effacer(CLE_TRI);
  else stockage.ecrire(CLE_TRI, tri);
}
