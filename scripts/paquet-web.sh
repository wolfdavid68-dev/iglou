#!/usr/bin/env bash
# Emballe le site exporté par Expo (dist/) pour le VPS : site.tar.gz + empreinte.
# Les routes dynamiques ([id].html) sont aussi copiées sous un nom sans crochets
# (_id.html), plus simple à servir pour Caddy.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f dist/index.html || { echo "dist/ absent : lancer d'abord npx expo export -p web" >&2; exit 1; }
for r in aliment appareil recette; do
  if [ -f "dist/$r/[id].html" ]; then cp "dist/$r/[id].html" "dist/$r/_id.html"; fi
done
rm -f site.tar.gz site.tar.gz.sha256
tar -czf site.tar.gz -C dist .
sha256sum site.tar.gz > site.tar.gz.sha256
echo "site.tar.gz : $(du -h site.tar.gz | cut -f1), $(cut -c1-12 site.tar.gz.sha256)"
