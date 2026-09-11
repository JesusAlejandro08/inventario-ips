#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="inventario-ips"
DB_NAME="inventario_ips"
DB_USER="inventario_app"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR"
WEB_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
BACKUP_SCRIPT_DIR="/usr/local/lib/$APP_NAME"
SUDOERS_RESTORE_FILE="/etc/sudoers.d/$APP_NAME-restore"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
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

trap 'printf "\n\033[1;31mInstalación interrumpida en la línea %s.\033[0m\n" "$LINENO" >&2' ERR

[[ $EUID -eq 0 ]] || fail "Ejecuta: sudo ./install.sh"
[[ -f "$FRONTEND_DIR/package.json" ]] ||
  fail "No se encontró package.json en la raíz."
[[ -f "$BACKEND_DIR/package.json" ]] ||
  fail "No se encontró backend/package.json."

if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
  APP_USER="$SUDO_USER"
else
  APP_USER="${INSTALL_USER:-root}"
fi

APP_GROUP="$(id -gn "$APP_USER")"

detect_ip() {
  local detected

  detected="$(
    ip -4 route get 1.1.1.1 2>/dev/null |
      awk '{
        for (i = 1; i <= NF; i++) {
          if ($i == "src") {
            print $(i + 1)
            exit
          }
        }
      }'
  )"

  if [[ -z "$detected" ]]; then
    detected="$(
      hostname -I 2>/dev/null |
        tr ' ' '\n' |
        awk '/^[0-9]+\./ && $0 !~ /^127\./ {print; exit}'
    )"
  fi

  printf '%s' "$detected"
}

port_in_use() {
  ss -H -ltn "sport = :$1" 2>/dev/null | grep -q .
}

find_free_port() {
  local port="$1"

  while ((port <= 65535)); do
    if ! port_in_use "$port"; then
      printf '%s' "$port"
      return 0
    fi

    ((port++))
  done

  return 1
}

DEFAULT_IP="$(detect_ip)"
[[ -n "$DEFAULT_IP" ]] ||
  fail "No fue posible detectar una dirección IPv4."

printf 'IP detectada: %s\n' "$DEFAULT_IP"

read -r -p \
  "IP o dominio para acceder a la aplicación [$DEFAULT_IP]: " \
  PUBLIC_HOST

PUBLIC_HOST="${PUBLIC_HOST:-$DEFAULT_IP}"

[[ "$PUBLIC_HOST" =~ ^[A-Za-z0-9.-]+$ ]] ||
  fail "Introduce una IPv4 o dominio sin http:// ni rutas."

CURRENT_WEB_PORT=""

if [[ -f "$NGINX_FILE" ]]; then
  CURRENT_WEB_PORT="$(
    sed -nE \
      's/^[[:space:]]*listen[[:space:]]+([0-9]+);/\1/p' \
      "$NGINX_FILE" |
      head -n 1
  )"
fi

if [[ "$CURRENT_WEB_PORT" =~ ^[0-9]+$ ]]; then
  DEFAULT_WEB_PORT="$CURRENT_WEB_PORT"
elif port_in_use 8100; then
  DEFAULT_WEB_PORT="$(find_free_port 8101)" ||
    fail "No se encontró un puerto web disponible."

  printf \
    'El puerto web 8100 está ocupado; se propone el puerto %s.\n' \
    "$DEFAULT_WEB_PORT"
else
  DEFAULT_WEB_PORT=8100
fi

read -r -p "Puerto web [$DEFAULT_WEB_PORT]: " WEB_PORT
WEB_PORT="${WEB_PORT:-$DEFAULT_WEB_PORT}"

[[ "$WEB_PORT" =~ ^[0-9]+$ ]] &&
  ((WEB_PORT >= 1 && WEB_PORT <= 65535)) ||
  fail "Puerto web no válido."

if port_in_use "$WEB_PORT" &&
  [[ "$WEB_PORT" != "$CURRENT_WEB_PORT" ]]; then
  fail "El puerto $WEB_PORT está ocupado. Ejecuta: sudo ss -ltnp 'sport = :$WEB_PORT'"
fi

CURRENT_BACKEND_PORT=""

if [[ -f "$BACKEND_DIR/.env" ]]; then
  CURRENT_BACKEND_PORT="$(
    sed -n 's/^PORT=//p' "$BACKEND_DIR/.env" |
      head -n 1
  )"
fi

if [[ "$CURRENT_BACKEND_PORT" =~ ^[0-9]+$ ]] && {
  ! port_in_use "$CURRENT_BACKEND_PORT" ||
    systemctl is-active --quiet "$APP_NAME"
}; then
  DEFAULT_BACKEND_PORT="$CURRENT_BACKEND_PORT"
elif port_in_use 39001; then
  DEFAULT_BACKEND_PORT="$(find_free_port 39002)" ||
    fail "No se encontró un puerto interno disponible."

  printf \
    'El puerto interno 39001 está ocupado; se propone el puerto %s.\n' \
    "$DEFAULT_BACKEND_PORT"
else
  DEFAULT_BACKEND_PORT=39001
fi

read -r -p \
  "Puerto interno del backend [$DEFAULT_BACKEND_PORT]: " \
  BACKEND_PORT

BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"

[[ "$BACKEND_PORT" =~ ^[0-9]+$ ]] &&
  ((BACKEND_PORT >= 1 && BACKEND_PORT <= 65535)) ||
  fail "Puerto interno no válido."

[[ "$BACKEND_PORT" != "$WEB_PORT" ]] ||
  fail "El backend y Nginx deben utilizar puertos diferentes."

if port_in_use "$BACKEND_PORT" &&
  [[ "$BACKEND_PORT" != "$CURRENT_BACKEND_PORT" ]]; then
  fail "El puerto interno $BACKEND_PORT está ocupado. Ejecuta: sudo ss -ltnp 'sport = :$BACKEND_PORT'"
fi

if [[ "$WEB_PORT" == "80" ]]; then
  PUBLIC_ORIGIN="http://${PUBLIC_HOST}"
else
  PUBLIC_ORIGIN="http://${PUBLIC_HOST}:${WEB_PORT}"
fi

read -r -p \
  "Nombre del administrador [Administrador de Sistemas]: " \
  ADMIN_NAME

ADMIN_NAME="${ADMIN_NAME:-Administrador de Sistemas}"

read -r -p "Usuario administrador [admin]: " ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"

[[ "$ADMIN_USER" =~ ^[A-Za-z0-9._-]{3,60}$ ]] ||
  fail "El usuario debe tener entre 3 y 60 caracteres válidos."

while true; do
  read -r -s -p \
    "Contraseña del administrador (mínimo 10 caracteres): " \
    ADMIN_PASSWORD

  printf '\n'

  if [[ ${#ADMIN_PASSWORD} -ge 10 ]]; then
    break
  fi

  printf 'La contraseña debe contener al menos 10 caracteres.\n'
done

log "Instalando dependencias del sistema"

export DEBIAN_FRONTEND=noninteractive

apt-get update

# NodeSource incluye npm dentro del paquete nodejs.
# No se debe instalar el paquete npm de Ubuntu por separado.
apt-get install -y \
  nodejs \
  mariadb-server \
  mariadb-client \
  nginx \
  rsync \
  openssl \
  curl \
  sudo \
  util-linux 
command -v node >/dev/null 2>&1 ||
  fail "Node.js no está instalado."

command -v npm >/dev/null 2>&1 ||
  fail "Node.js fue instalado, pero npm no está disponible."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"

((NODE_MAJOR >= 20)) ||
  fail "Se requiere Node.js 20 o posterior. Versión encontrada: $(node -v)"

EXISTING_DB_PASSWORD=""
EXISTING_JWT_SECRET=""

if [[ -f "$BACKEND_DIR/.env" ]]; then
  EXISTING_DB_PASSWORD="$(
    sed -n 's/^DB_PASSWORD=//p' "$BACKEND_DIR/.env" |
      head -n 1
  )"

  EXISTING_JWT_SECRET="$(
    sed -n 's/^JWT_SECRET=//p' "$BACKEND_DIR/.env" |
      head -n 1
  )"
fi

DB_PASSWORD="${EXISTING_DB_PASSWORD:-$(openssl rand -hex 24)}"
JWT_SECRET="${EXISTING_JWT_SECRET:-$(openssl rand -hex 32)}"

systemctl enable --now mariadb

log "Instalando dependencias de la aplicación"

if [[ -f "$FRONTEND_DIR/package-lock.json" ]]; then
  sudo -u "$APP_USER" npm ci --prefix "$FRONTEND_DIR"
else
  sudo -u "$APP_USER" npm install --prefix "$FRONTEND_DIR"
fi

if [[ -f "$BACKEND_DIR/package-lock.json" ]]; then
  sudo -u "$APP_USER" npm ci --prefix "$BACKEND_DIR"
else
  sudo -u "$APP_USER" npm install --prefix "$BACKEND_DIR"
fi

log "Creando base de datos y tablas"

mariadb <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME}
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS
  '${DB_USER}'@'localhost'
  IDENTIFIED BY '${DB_PASSWORD}';

ALTER USER
  '${DB_USER}'@'localhost'
  IDENTIFIED BY '${DB_PASSWORD}';

CREATE USER IF NOT EXISTS
  '${DB_USER}'@'127.0.0.1'
  IDENTIFIED BY '${DB_PASSWORD}';

ALTER USER
  '${DB_USER}'@'127.0.0.1'
  IDENTIFIED BY '${DB_PASSWORD}';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ${DB_NAME}.*
  TO '${DB_USER}'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ${DB_NAME}.*
  TO '${DB_USER}'@'127.0.0.1';

GRANT
  SELECT,
  INSERT,
  UPDATE,
  DELETE,
  SHOW VIEW,
  TRIGGER,
  EVENT
ON ${DB_NAME}.*
TO '${DB_USER}'@'localhost';

GRANT
  SELECT,
  INSERT,
  UPDATE,
  DELETE,
  SHOW VIEW,
  TRIGGER,
  EVENT
ON ${DB_NAME}.*
TO '${DB_USER}'@'127.0.0.1';

FLUSH PRIVILEGES;

USE ${DB_NAME};

CREATE TABLE IF NOT EXISTS segmentos_red (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion_red VARCHAR(15) NOT NULL,
  prefijo TINYINT UNSIGNED NOT NULL,
  gateway VARCHAR(15) NULL,
  vlan SMALLINT UNSIGNED NULL,
  ubicacion VARCHAR(120) NOT NULL,
  descripcion VARCHAR(255) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_segmento_red (direccion_red, prefijo),
  CONSTRAINT chk_prefijo
    CHECK (prefijo BETWEEN 0 AND 32),
  CONSTRAINT chk_vlan
    CHECK (vlan IS NULL OR vlan BETWEEN 1 AND 4094)
);

CREATE TABLE IF NOT EXISTS direcciones_ip (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  segmento_id INT UNSIGNED NOT NULL,
  direccion_ip VARCHAR(15) NOT NULL,
  hostname VARCHAR(100) NULL,
  dispositivo VARCHAR(120) NOT NULL,
  ubicacion VARCHAR(120) NOT NULL,
  responsable VARCHAR(120) NULL,
  estado ENUM(
    'Disponible',
    'En uso',
    'Reservada',
    'Inactiva'
  ) NOT NULL DEFAULT 'Disponible',
  observaciones TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_direccion_ip (direccion_ip),
  KEY idx_segmento_id (segmento_id),
  KEY idx_estado (estado),
  CONSTRAINT fk_ip_segmento
    FOREIGN KEY (segmento_id)
    REFERENCES segmentos_red(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  usuario VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM(
    'Administrador',
    'Consulta'
  ) NOT NULL DEFAULT 'Consulta',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso DATETIME NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_usuario (usuario)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NULL,
  accion ENUM(
    'INICIAR_SESION',
    'CREAR',
    'ACTUALIZAR',
    'ELIMINAR'
  ) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id VARCHAR(50) NULL,
  detalles JSON NULL,
  direccion_ip VARCHAR(45) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_auditoria_usuario (usuario_id),
  KEY idx_auditoria_entidad (entidad, entidad_id),
  KEY idx_auditoria_fecha (creado_en),
  CONSTRAINT fk_auditoria_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);
SQL

log "Configurando almacenamiento de respaldos"

install -d \
  -m 750 \
  -o "$APP_USER" \
  -g "$APP_GROUP" \
  "$BACKUP_DIR"

log "Generando configuración privada"

log "Instalando scripts de respaldo y restauración"

[[ -f "$SCRIPT_DIR/scripts/backup-db.sh" ]] ||
  fail "No se encontró scripts/backup-db.sh."

[[ -f "$SCRIPT_DIR/scripts/restore-db.sh" ]] ||
  fail "No se encontró scripts/restore-db.sh."

install -d \
  -m 755 \
  -o root \
  -g root \
  "$BACKUP_SCRIPT_DIR"

install \
  -m 750 \
  -o root \
  -g root \
  "$SCRIPT_DIR/scripts/backup-db.sh" \
  "$BACKUP_SCRIPT_DIR/backup-db.sh"

install \
  -m 750 \
  -o root \
  -g root \
  "$SCRIPT_DIR/scripts/restore-db.sh" \
  "$BACKUP_SCRIPT_DIR/restore-db.sh"
  log "Configurando autorización segura de restauración"

cat >"$SUDOERS_RESTORE_FILE" <<SUDOERS
${APP_USER} ALL=(root) NOPASSWD: ${BACKUP_SCRIPT_DIR}/restore-db.sh *
SUDOERS

chmod 440 "$SUDOERS_RESTORE_FILE"
chown root:root "$SUDOERS_RESTORE_FILE"

visudo -cf "$SUDOERS_RESTORE_FILE" ||
  fail "La configuración sudoers de restauración no es válida."

install \
  -m 600 \
  -o "$APP_USER" \
  -g "$APP_GROUP" \
  /dev/null \
  "$BACKEND_DIR/.env"

cat >"$BACKEND_DIR/.env" <<ENV
PORT=${BACKEND_PORT}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
FRONTEND_URL=${PUBLIC_ORIGIN}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h
ENV

chown "$APP_USER:$APP_GROUP" "$BACKEND_DIR/.env"
chmod 600 "$BACKEND_DIR/.env"

ADMIN_EXISTS="$(
  mariadb -N -s -e \
    "SELECT COUNT(*) FROM ${DB_NAME}.usuarios WHERE usuario='${ADMIN_USER//\'/\'\'}';"
)"

if [[ "$ADMIN_EXISTS" == "0" ]]; then
  sudo -u "$APP_USER" env \
    ADMIN_NOMBRE="$ADMIN_NAME" \
    ADMIN_USUARIO="$ADMIN_USER" \
    ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    npm run crear-admin --prefix "$BACKEND_DIR"
else
  printf \
    'El usuario administrador %s ya existe; se conservará.\n' \
    "$ADMIN_USER"
fi

unset ADMIN_PASSWORD

log "Compilando frontend"

sudo -u "$APP_USER" env \
  VITE_API_URL=/api \
  npm run build --prefix "$FRONTEND_DIR"

install -d -m 755 "$WEB_DIR"

rsync -a --delete \
  "$FRONTEND_DIR/dist/" \
  "$WEB_DIR/"

chown -R www-data:www-data "$WEB_DIR"

log "Creando servicio systemd"

cat >"$SERVICE_FILE" <<UNIT
[Unit]
Description=API del inventario de direcciones IP
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStartPre=+/usr/bin/ln -sfn ${NGINX_FILE} ${NGINX_LINK}
ExecStartPre=+/usr/sbin/nginx -t
ExecStart=$(command -v node) ${BACKEND_DIR}/src/server.js
ExecStartPost=+/usr/bin/systemctl reload nginx
ExecReload=+/usr/sbin/nginx -t
ExecReload=+/usr/bin/systemctl reload nginx
ExecStopPost=+/usr/bin/rm -f ${NGINX_LINK}
ExecStopPost=-+/usr/sbin/nginx -t
ExecStopPost=-+/usr/bin/systemctl reload nginx
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=false
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${BACKUP_DIR} /etc/nginx/sites-enabled

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload

log "Configurando Nginx"

cat >"$NGINX_FILE" <<NGINX
server {
    listen ${WEB_PORT};
    listen [::]:${WEB_PORT};
    server_name ${PUBLIC_HOST};

    root ${WEB_DIR};
    index index.html;

    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ /\\. {
        deny all;
    }
}
NGINX

ln -sfn "$NGINX_FILE" "$NGINX_LINK"

nginx -t
systemctl enable nginx
systemctl restart nginx

if command -v ufw >/dev/null 2>&1 &&
  ufw status | grep -q '^Status: active'; then
  ufw allow "${WEB_PORT}/tcp" >/dev/null
fi

log "Iniciando frontend y backend como un solo servicio"

# Retira las unidades agrupadoras de versiones anteriores, si existen.
systemctl disable --now "${APP_NAME}-stack.target" 2>/dev/null || true
rm -f -- \
  "/etc/systemd/system/${APP_NAME}-stack.target" \
  "/etc/systemd/system/${APP_NAME}-dashboard.service"
rm -rf -- "/etc/systemd/system/${APP_NAME}.service.d"

systemctl daemon-reload
systemctl enable "${APP_NAME}.service"
systemctl restart "${APP_NAME}.service"

log "Verificando servicios"

systemctl is-active --quiet "$APP_NAME" ||
  fail "El backend no inició. Revisa: journalctl -u $APP_NAME"

systemctl is-active --quiet nginx ||
  fail "Nginx no inició."

BACKEND_READY=false

for _ in $(seq 1 20); do
  if curl --fail --silent \
    "http://127.0.0.1:${BACKEND_PORT}/api/salud" \
    >/dev/null; then
    BACKEND_READY=true
    break
  fi

  sleep 1
done

[[ "$BACKEND_READY" == "true" ]] ||
  fail "El backend no respondió. Revisa: journalctl -u $APP_NAME"

curl --fail --silent \
  -H "Host: ${PUBLIC_HOST}" \
  "http://127.0.0.1:${WEB_PORT}/api/salud" \
  >/dev/null ||
  fail "Nginx no pudo comunicarse con el backend."

ok "Instalación completada"

printf '\nAplicación: %s\n' "$PUBLIC_ORIGIN"
printf 'Usuario administrador: %s\n' "$ADMIN_USER"
printf 'Puerto web: %s\n' "$WEB_PORT"
printf 'Puerto interno del backend: %s\n' "$BACKEND_PORT"
printf 'Servicio: systemctl status %s\n' "$APP_NAME"
printf '\nControl unificado:\n'
printf '  Iniciar:   sudo systemctl start %s\n' "$APP_NAME"
printf '  Detener:   sudo systemctl stop %s\n' "$APP_NAME"
printf '  Reiniciar: sudo systemctl restart %s\n' "$APP_NAME"
printf '  Recargar:  sudo systemctl reload %s\n' "$APP_NAME"
