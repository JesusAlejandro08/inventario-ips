#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="inventario-ips"
DB_NAME="${DB_NAME:-inventario_ips}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/$APP_NAME}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
TEMP_FILE=""

log() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ -n "$TEMP_FILE" && -f "$TEMP_FILE" ]]; then
    rm -f -- "$TEMP_FILE"
  fi
}

trap cleanup EXIT
trap 'fail "El respaldo falló en la línea $LINENO."' ERR

[[ $EUID -eq 0 ]] ||
  fail "Ejecuta: sudo ./scripts/backup-db.sh"

[[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] ||
  fail "El nombre de la base de datos no es válido."

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] ||
  fail "RETENTION_DAYS debe ser un número entero."

command -v mariadb-dump >/dev/null 2>&1 ||
  fail "No se encontró mariadb-dump."

command -v gzip >/dev/null 2>&1 ||
  fail "No se encontró gzip."

mariadb -N -s -e \
  "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='${DB_NAME}';" |
  grep -qx "$DB_NAME" ||
  fail "La base de datos $DB_NAME no existe."

umask 077
install -d -m 700 "$BACKUP_DIR"
TEMP_FILE="$(mktemp "$BACKUP_DIR/.respaldo-temporal.XXXXXX")"

log "Generando respaldo de $DB_NAME"

mariadb-dump \
  --single-transaction \
  --quick \
  --routines \
  --events \
  --triggers \
  --hex-blob \
  --default-character-set=utf8mb4 \
  --databases "$DB_NAME" |
gzip -9 >"$TEMP_FILE"

[[ -s "$TEMP_FILE" ]] ||
  fail "El archivo generado está vacío."

gzip -t "$TEMP_FILE"

mv -- "$TEMP_FILE" "$BACKUP_FILE"
TEMP_FILE=""

sha256sum "$BACKUP_FILE" >"$CHECKSUM_FILE"
chmod 600 "$BACKUP_FILE" "$CHECKSUM_FILE"

log "Eliminando respaldos con más de $RETENTION_DAYS días"

find "$BACKUP_DIR" \
  -maxdepth 1 \
  -type f \
  \( -name "${DB_NAME}-*.sql.gz" -o \
     -name "${DB_NAME}-*.sql.gz.sha256" \) \
  -mtime "+$RETENTION_DAYS" \
  -delete

printf '\nRespaldo creado correctamente:\n%s\n' "$BACKUP_FILE"
du -h "$BACKUP_FILE"
