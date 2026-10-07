import * as DocumentPicker from 'expo-document-picker';

/** Sur le web : téléchargement direct du fichier. */
export async function partagerJson(nomFichier: string, contenu: unknown): Promise<void> {
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function choisirJson(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return a.file ? a.file.text() : (await fetch(a.uri)).text();
}
