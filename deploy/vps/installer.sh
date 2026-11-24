#!/usr/bin/env bash
# Installe le site iglou sur un VPS Ubuntu/Debian (à lancer une fois, en root) :
#
#   curl -fsSL https://raw.githubusercontent.com/wolfdavid68-dev/iglou/master/deploy/vps/installer.sh | bash -s -- iglou.mediurg.systems
#
# - Caddy sert le site en HTTPS (certificat Let's Encrypt automatique) ;
# - toutes les 2 minutes, iglou-maj installe la dernière version publiée par
#   la GitHub Action « Publier iglou » (release « site-web » du dépôt public).
# Aucune clé n'est stockée sur le VPS. Relancer ce script est sans danger.
set -euo pipefail

DOMAINE="${1:-iglou.mediurg.systems}"
DEPOT="${IGLOU_DEPOT:-wolfdavid68-dev/iglou}"
SITE=/srv/iglou

[ "$(id -u)" = 0 ] || { echo "À lancer en root (sudo)." >&2; exit 1; }

echo "== Paquets"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq caddy curl ca-certificates tar >/dev/null

echo "== Mise à jour automatique du site"
mkdir -p "$SITE/versions"
cat > /etc/default/iglou <<CONF
# Lu par iglou-maj. Adresse de la version publiée par la GitHub Action.
IGLOU_URL=https://github.com/$DEPOT/releases/download/site-web/site.tar.gz
CONF

cat > /usr/local/bin/iglou-maj <<'MAJ'
#!/usr/bin/env bash
# Installe la dernière version publiée du site si elle a changé.
set -euo pipefail
. /etc/default/iglou
SITE=/srv/iglou
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 2 "$IGLOU_URL.sha256" -o "$tmp/empreinte" || { echo "Aucune version publiée pour l'instant."; exit 0; }
nouvelle=$(cut -d' ' -f1 "$tmp/empreinte")
[[ "$nouvelle" =~ ^[0-9a-f]{64}$ ]] || { echo "Empreinte illisible." >&2; exit 1; }
[ "$(cat "$SITE/version" 2>/dev/null || true)" = "$nouvelle" ] && exit 0
curl -fsSL --retry 2 "$IGLOU_URL" -o "$tmp/site.tar.gz"
echo "$nouvelle  $tmp/site.tar.gz" | sha256sum -c --quiet
dossier="$SITE/versions/$(date -u +%Y%m%d%H%M%S)-${nouvelle:0:12}"
mkdir -p "$dossier"
tar -xzf "$tmp/site.tar.gz" -C "$dossier" --no-same-owner
test -f "$dossier/index.html"
chmod -R a+rX "$dossier"
# Bascule atomique : les visiteurs voient l'ancienne version ou la nouvelle, jamais un mélange.
ln -sfn "$dossier" "$SITE/courant.tmp" && mv -Tf "$SITE/courant.tmp" "$SITE/courant"
echo "$nouvelle" > "$SITE/version"
# On garde les 3 dernières versions.
ls -1d "$SITE"/versions/* | sort | head -n -3 | xargs -r rm -rf
echo "Site mis à jour : ${nouvelle:0:12}"
MAJ
chmod 755 /usr/local/bin/iglou-maj

cat > /etc/systemd/system/iglou-maj.service <<'UNIT'
[Unit]
Description=Iglou : installe la dernière version publiée du site
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/iglou-maj
UNIT

cat > /etc/systemd/system/iglou-maj.timer <<'UNIT'
[Unit]
Description=Iglou : vérifie toutes les 2 minutes s'il y a une nouvelle version du site

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

echo "== Caddy ($DOMAINE)"
cat > /etc/caddy/Caddyfile <<CADDY
# Site iglou (installé par deploy/vps/installer.sh). HTTPS automatique.
$DOMAINE {
	root * $SITE/courant
	encode zstd gzip
	# Comme sur Firebase : toujours revalider, pour que chaque publication se voie tout de suite.
	header Cache-Control "no-cache"
	@manifeste path *.webmanifest
	header @manifeste Content-Type application/manifest+json

	route {
		# Fiches : /aliment/<id> → la page de la route dynamique.
		@aliment {
			path /aliment/*
			not file {path} {path}.html
		}
		rewrite @aliment /aliment/_id.html
		@appareil {
			path /appareil/*
			not file {path} {path}.html
		}
		rewrite @appareil /appareil/_id.html
		@recette {
			path /recette/*
			not file {path} {path}.html
		}
		rewrite @recette /recette/_id.html

		# Adresses sans « .html » (/confidentialite → confidentialite.html).
		try_files {path} {path}.html {path}/index.html
		file_server
	}

	handle_errors {
		@introuvable expression {err.status_code} == 404
		handle @introuvable {
			rewrite * /+not-found.html
			file_server
		}
	}
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null

systemctl daemon-reload
systemctl enable --now iglou-maj.timer
/usr/local/bin/iglou-maj || true
systemctl enable caddy >/dev/null 2>&1
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# Pare-feu local éventuel : ouvrir le web.
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

echo
echo "Terminé. Site : https://$DOMAINE"
echo "Version installée : $(cut -c1-12 $SITE/version 2>/dev/null || echo 'aucune encore — elle arrivera après la prochaine publication')"
