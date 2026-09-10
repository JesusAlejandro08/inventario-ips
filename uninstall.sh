#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="inventario-ips"
DB_NAME="inventario_ips"
DB_USER="inventario_app"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
WEB_DIR="/var/www/$APP_NAME"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
NGINX_FILE="/etc/nginx/sites-available/$APP_NAME"
NGINX_LINK="/etc/nginx/sites-enabled/$APP_NAME"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok() { printf '\033[1;32m✔ %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31m✘ %s\033[0m\n' "$1" >&2; exit 1; }

trap 'printf "\n\033[1;31mDesinstalación interrumpida en la línea %s.\033[0m\n" "$LINENO" >&2' ERR

[[ $EUID -eq 0 ]] || fail "Ejecuta: sudo ./uninstall.sh"
[[ "$SCRIPT_DIR" != "/" ]] || fail "No se permite ejecutar desde el directorio raíz."

printf '%s\n' "Esta operación eliminará permanentemente:"
printf '  - Servicio systemd: %s\n' "$APP_NAME"
printf '  - Configuración y archivos web de Nginx\n'
printf '  - Base de datos: %s (incluidos todos sus datos)\n' "$DB_NAME"
printf '  - Usuarios MariaDB: %s@localhost y %s@127.0.0.1\n' "$DB_USER" "$DB_USER"
printf '  - backend/.env, dist y dependencias node_modules\n'
printf '\nNo se eliminará el repositorio ni los paquetes compartidos Node.js, MariaDB o Nginx.\n\n'

read -r -p "Escribe ELIMINAR para continuar: " CONFIRMATION
[[ "$CONFIRMATION" == "ELIMINAR" ]] || fail "Operación cancelada."

command -v mariadb >/dev/null 2>&1 || fail "El cliente de MariaDB no está disponible."
systemctl is-active --quiet mariadb || fail "MariaDB no está activo; inícialo antes de desinstalar."

log "Deteniendo y eliminando el servicio"
if systemctl cat "${APP_NAME}.service" >/dev/null 2>&1; then
  systemctl disable --now "$APP_NAME" 2>/dev/null || true
fi
if [[ -f "$SERVICE_FILE" ]]; then
  rm -f -- "$SERVICE_FILE"
  systemctl daemon-reload
  systemctl reset-failed "$APP_NAME" 2>/dev/null || true
fi

log "Retirando configuración de Nginx"
rm -f -- "$NGINX_LINK" "$NGINX_FILE"
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  fi
fi

log "Eliminando base de datos y usuarios de la aplicación"
mariadb <<SQL
DROP DATABASE IF EXISTS \`${DB_NAME}\`;
DROP USER IF EXISTS '${DB_USER}'@'localhost';
DROP USER IF EXISTS '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

log "Eliminando archivos generados"
rm -rf -- "$WEB_DIR"
rm -f -- "/var/log/nginx/${APP_NAME}-access.log" "/var/log/nginx/${APP_NAME}-error.log"
rm -f -- "$BACKEND_DIR/.env"
rm -rf -- "$SCRIPT_DIR/dist" "$SCRIPT_DIR/node_modules" "$BACKEND_DIR/node_modules"

ok "Desinstalación completada"
printf '\nEl código fuente permanece en: %s\n' "$SCRIPT_DIR"
printf 'Para borrarlo también, elimina manualmente el repositorio después de salir de esa carpeta.\n'
