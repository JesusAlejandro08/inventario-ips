#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="inventario-ips"
DB_NAME="inventario_ips"
DB_USER="inventario_app"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
WEB_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"

SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
BACKUP_SERVICE_FILE="/etc/systemd/system/$APP_NAME-backup.service"
BACKUP_TIMER_FILE="/etc/systemd/system/$APP_NAME-backup.timer"
BACKUP_SCRIPT_DIR="/usr/local/lib/$APP_NAME"

NGINX_FILE="/etc/nginx/sites-available/$APP_NAME"
NGINX_LINK="/etc/nginx/sites-enabled/$APP_NAME"

log() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

ok() {
  printf '\033[1;32m✔ %s\033[0m\n' "$1"
}

fail() {
  printf '\033[1;31m✘ %s\033[0m\n' "$1" >&2
  exit 1
}

trap 'printf "\n\033[1;31mDesinstalación interrumpida en la línea %s.\033[0m\n" "$LINENO" >&2' ERR

[[ $EUID -eq 0 ]] ||
  fail "Ejecuta: sudo ./uninstall.sh"

[[ "$SCRIPT_DIR" != "/" ]] ||
  fail "No se permite ejecutar desde el directorio raíz."

printf '%s\n' "Esta operación eliminará permanentemente:"
printf '  - Servicio systemd: %s\n' "$APP_NAME"
printf '  - Servicio y temporizador de respaldos\n'
printf '  - Configuración y archivos web de Nginx\n'
printf '  - Base de datos: %s y todos sus datos\n' "$DB_NAME"
printf '  - Usuarios MariaDB de la aplicación\n'
printf '  - Respaldos almacenados en: %s\n' "$BACKUP_DIR"
printf '  - backend/.env, dist y node_modules\n'
printf '\n'
printf '%s\n' \
  "No se eliminarán Node.js, MariaDB ni Nginx porque pueden ser utilizados por otros servicios."
printf '\n'

read -r -p "Escribe ELIMINAR para continuar: " CONFIRMATION

[[ "$CONFIRMATION" == "ELIMINAR" ]] ||
  fail "Operación cancelada."

command -v mariadb >/dev/null 2>&1 ||
  fail "El cliente de MariaDB no está disponible."

systemctl is-active --quiet mariadb ||
  fail "MariaDB no está activo; inícialo antes de desinstalar."

log "Deteniendo los respaldos automáticos"

systemctl disable --now "$APP_NAME-backup.timer" \
  2>/dev/null || true

systemctl stop "$APP_NAME-backup.service" \
  2>/dev/null || true

log "Deteniendo el backend"

systemctl disable --now "$APP_NAME" \
  2>/dev/null || true

log "Eliminando servicios systemd"

rm -f -- \
  "$SERVICE_FILE" \
  "$BACKUP_SERVICE_FILE" \
  "$BACKUP_TIMER_FILE"

systemctl daemon-reload
systemctl reset-failed "$APP_NAME" 2>/dev/null || true
systemctl reset-failed "$APP_NAME-backup.service" 2>/dev/null || true

log "Retirando configuración de Nginx"

rm -f -- "$NGINX_LINK" "$NGINX_FILE"

if command -v nginx >/dev/null 2>&1; then
  nginx -t

  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  fi
fi

log "Eliminando base de datos y usuarios"

mariadb <<SQL
DROP DATABASE IF EXISTS \`${DB_NAME}\`;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
DROP USER IF EXISTS '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

log "Eliminando archivos generados"

rm -rf -- "$WEB_DIR"
rm -rf -- "$BACKUP_DIR"
rm -rf -- "$BACKUP_SCRIPT_DIR"

rm -f -- \
  "/var/log/nginx/${APP_NAME}-access.log" \
  "/var/log/nginx/${APP_NAME}-error.log"

rm -f -- "$BACKEND_DIR/.env"

rm -rf -- \
  "$SCRIPT_DIR/dist" \
  "$SCRIPT_DIR/node_modules" \
  "$BACKEND_DIR/node_modules"

ok "Desinstalación completada"

printf '\nEl código fuente permanece en: %s\n' "$SCRIPT_DIR"
printf '%s\n' \
  "El repositorio debe eliminarse manualmente si ya no se necesita."