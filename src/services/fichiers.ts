import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Écrit le JSON dans le cache puis ouvre la feuille de partage Android. */
export async function partagerJson(nomFichier: string, contenu: unknown): Promise<void> {
  const fichier = new File(Paths.cache, nomFichier);
  fichier.create({ overwrite: true });
  fichier.write(JSON.stringify(contenu, null, 2));
  await Sharing.shareAsync(fichier.uri, { mimeType: 'application/json', dialogTitle: 'Exporter l’inventaire' });
}

/** Ouvre le sélecteur de fichiers. `null` si l'utilisateur annule. */
export async function choisirJson(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  return new File(r.assets[0].uri).text();
}
