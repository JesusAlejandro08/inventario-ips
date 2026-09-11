#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="inventario-ips"
DB_NAME="inventario_ips"
BACKUP_DIR="/var/backups/$APP_NAME"
BACKUP_SCRIPT="/usr/local/lib/$APP_NAME/backup-db.sh"
LOCK_FILE="/run/lock/$APP_NAME-restore.lock"

log() {
  printf '==> %s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

[[ $EUID -eq 0 ]] ||
  fail "La restauración requiere privilegios administrativos."

BACKUP_NAME="${1:-}"

[[ "$BACKUP_NAME" =~ ^inventario_ips-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}\.sql\.gz$ ]] ||
  fail "El nombre del respaldo no es válido."

BACKUP_FILE="$BACKUP_DIR/$BACKUP_NAME"
CHECKSUM_FILE="$BACKUP_FILE.sha256"

[[ -f "$BACKUP_FILE" ]] ||
  fail "El respaldo solicitado no existe."

[[ ! -L "$BACKUP_FILE" ]] ||
  fail "No se permite restaurar un enlace simbólico."

REAL_BACKUP_DIR="$(realpath "$BACKUP_DIR")"
REAL_BACKUP_FILE="$(realpath "$BACKUP_FILE")"

[[ "$(dirname "$REAL_BACKUP_FILE")" == "$REAL_BACKUP_DIR" ]] ||
  fail "El respaldo está fuera del directorio permitido."

command -v gzip >/dev/null 2>&1 ||
  fail "No se encontró gzip."

command -v mariadb >/dev/null 2>&1 ||
  fail "No se encontró el cliente MariaDB."

command -v flock >/dev/null 2>&1 ||
  fail "No se encontró flock."

exec 9>"$LOCK_FILE"

flock -n 9 ||
  fail "Ya existe otra restauración en proceso."

log "Validando integridad del respaldo"

gzip -t "$BACKUP_FILE"

if [[ -f "$CHECKSUM_FILE" ]]; then
  (
    cd "$BACKUP_DIR"
    sha256sum -c "$(basename "$CHECKSUM_FILE")"
  )
fi

log "Creando respaldo preventivo"

if [[ -x "$BACKUP_SCRIPT" ]]; then
  "$BACKUP_SCRIPT"
else
  fail "No está instalado el script de respaldo preventivo."
fi

log "Restaurando base de datos"

gzip -dc "$BACKUP_FILE" |
  mariadb --binary-mode

log "Registrando restauración"

mariadb "$DB_NAME" <<SQL
INSERT INTO auditoria (
  usuario_id,
  accion,
  entidad,
  entidad_id,
  detalles,
  direccion_ip
)
VALUES (
  NULL,
  'ACTUALIZAR',
  'respaldo',
  NULL,
  JSON_OBJECT(
    'operacion', 'RESTAURAR',
    'archivo', '${BACKUP_NAME}'
  ),
  '127.0.0.1'
);
SQL

printf 'Restauración completada correctamente: %s\n' \
  "$BACKUP_NAME"
