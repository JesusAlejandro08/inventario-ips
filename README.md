# Inventario de Direcciones IP

Aplicación web para administrar segmentos de red y registrar manualmente direcciones IPv4. Incluye autenticación, roles, auditoría, cálculo de disponibilidad y persistencia en MariaDB.

## Arquitectura

```text
Usuario en la LAN
      │ HTTP :80
      ▼
    Nginx
      ├── /       → React compilado
      └── /api/   → Express en 127.0.0.1:3000
                              │
                              ▼
                     MariaDB en 127.0.0.1:3306
```

| Componente    | Tecnología        | Función                                             |
| ------------- | ----------------- | --------------------------------------------------- |
| Frontend      | React + Vite      | Interfaz de inventario y administración             |
| Backend       | Node.js + Express | API REST, validación y autorización                 |
| Base de datos | MariaDB           | Persistencia de segmentos, IP, usuarios y auditoría |
| Proxy web     | Nginx             | Publicación del frontend y proxy de `/api`          |
| Servicio      | systemd           | Inicio y reinicio automático del backend            |

## Funciones principales

- Inicio de sesión mediante JWT.
- Contraseñas protegidas con bcrypt.
- Roles `Administrador` y `Consulta`.
- Creación, edición y eliminación de segmentos de red.
- Registro manual de direcciones IPv4.
- Validación de pertenencia de una IP a su segmento.
- Prevención de direcciones duplicadas.
- Cálculo de capacidad y direcciones disponibles.
- Explorador visual de direcciones disponibles, ocupadas y reservadas.
- Administración de usuarios.
- Registro de operaciones en una bitácora de auditoría.

## Permisos

| Función                            | Administrador | Consulta |
| ---------------------------------- | :-----------: | :------: |
| Consultar direcciones IP           |      Sí       |    Sí    |
| Consultar segmentos                |      Sí       |    Sí    |
| Ver direcciones disponibles        |      Sí       |    Sí    |
| Crear, editar o eliminar IP        |      Sí       |    No    |
| Crear, editar o eliminar segmentos |      Sí       |    No    |
| Administrar usuarios               |      Sí       |    No    |
| Consultar auditoría                |      Sí       |    No    |

El backend aplica los permisos aunque alguien intente llamar directamente a la API.

## Requisitos

- Kali Linux, Debian o Ubuntu con `systemd`.
- Acceso con `sudo`.
- Conexión a los repositorios del sistema.
- Node.js 20 o posterior.
- Puerto TCP 80 disponible.
- Acceso desde los clientes hacia la IP del servidor.

## Instalación automática

Clonar el repositorio:

```bash
git clone https://github.com/JesusAlejandro08/inventario-ips.git
cd inventario-ips
chmod +x install.sh
sudo ./install.sh
```

El instalador solicita:

1. IP o dominio de acceso. Detecta automáticamente la IPv4 principal.
2. Nombre del administrador.
3. Nombre de usuario del administrador.
4. Contraseña inicial de al menos 10 caracteres.

El instalador realiza automáticamente:

- instalación de Node.js, MariaDB, Nginx, rsync, OpenSSL y curl;
- instalación de dependencias npm del frontend y backend;
- creación de la base de datos y sus tablas;
- generación de contraseña interna para MariaDB;
- generación del secreto JWT;
- creación del administrador inicial;
- compilación de React con `VITE_API_URL=/api`;
- publicación del frontend en Nginx;
- creación y activación del servicio del backend;
- validación de la API y del proxy web.

Al finalizar muestra una URL similar a:

```text
http://192.168.3.241
```

## Accesos y puertos

| Servicio           | Dirección                    | Exposición recomendada |
| ------------------ | ---------------------------- | ---------------------- |
| Aplicación web     | `http://IP_DEL_SERVIDOR`     | LAN                    |
| API mediante Nginx | `http://IP_DEL_SERVIDOR/api` | LAN                    |
| API directa        | `http://127.0.0.1:3000/api`  | Solo localhost         |
| MariaDB            | `127.0.0.1:3306`             | Solo localhost         |
| Desarrollo Vite    | `http://localhost:5173`      | Solo desarrollo        |

No se recomienda exponer los puertos `3000`, `3306` o `5173` a la red.

## Ubicaciones instaladas

| Elemento              | Ruta                                         |
| --------------------- | -------------------------------------------- |
| Código clonado        | Directorio donde se ejecutó `git clone`      |
| Backend               | `<repositorio>/backend`                      |
| Configuración privada | `<repositorio>/backend/.env`                 |
| Frontend compilado    | `/var/www/inventario-ips`                    |
| Unidad systemd        | `/etc/systemd/system/inventario-ips.service` |
| Configuración Nginx   | `/etc/nginx/sites-available/inventario-ips`  |
| Enlace Nginx          | `/etc/nginx/sites-enabled/inventario-ips`    |
| Log de acceso Nginx   | `/var/log/nginx/inventario-ips-access.log`   |
| Log de error Nginx    | `/var/log/nginx/inventario-ips-error.log`    |

## Servicio del backend

Consultar estado:

```bash
sudo systemctl status inventario-ips
```

Reiniciar:

```bash
sudo systemctl restart inventario-ips
```

Detener e iniciar:

```bash
sudo systemctl stop inventario-ips
sudo systemctl start inventario-ips
```

Consultar registros:

```bash
sudo journalctl -u inventario-ips -n 100 --no-pager
sudo journalctl -u inventario-ips -f
```

## Nginx

Validar configuración:

```bash
sudo nginx -t
```

Recargar configuración:

```bash
sudo systemctl reload nginx
```

Consultar estado:

```bash
sudo systemctl status nginx
```

## MariaDB

### Base y tablas

Base de datos:

```text
inventario_ips
```

Tablas:

| Tabla            | Contenido                                  |
| ---------------- | ------------------------------------------ |
| `segmentos_red`  | Redes, prefijos, gateway, VLAN y ubicación |
| `direcciones_ip` | IP, equipo, responsable, estado y segmento |
| `usuarios`       | Cuenta, hash de contraseña, rol y estado   |
| `auditoria`      | Inicio de sesión y operaciones realizadas  |

Consultar las tablas como administrador del sistema:

```bash
sudo mariadb inventario_ips -e "SHOW TABLES;"
```

Consultar usuarios sin mostrar hashes:

```bash
sudo mariadb inventario_ips -e \
  "SELECT id, nombre, usuario, rol, activo FROM usuarios;"
```

Las credenciales internas de la aplicación están en:

```text
<repositorio>/backend/.env
```

Este archivo tiene permisos restrictivos y no debe subirse a Git.

## Variables del backend

Ejemplo sin valores sensibles:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=inventario_app
DB_PASSWORD=VALOR_GENERADO
DB_NAME=inventario_ips
FRONTEND_URL=http://IP_DEL_SERVIDOR
JWT_SECRET=VALOR_GENERADO
JWT_EXPIRES_IN=8h
```

Después de modificar `.env`, reiniciar:

```bash
sudo systemctl restart inventario-ips
```

## Endpoints principales

| Método   | Ruta                             | Descripción              |
| -------- | -------------------------------- | ------------------------ |
| `GET`    | `/api/salud`                     | Estado público de la API |
| `POST`   | `/api/auth/login`                | Inicio de sesión         |
| `GET`    | `/api/auth/sesion`               | Validación de sesión     |
| `GET`    | `/api/segmentos`                 | Listar segmentos         |
| `POST`   | `/api/segmentos`                 | Crear segmento           |
| `PUT`    | `/api/segmentos/:id`             | Actualizar segmento      |
| `DELETE` | `/api/segmentos/:id`             | Eliminar segmento        |
| `GET`    | `/api/segmentos/:id/direcciones` | Explorar direcciones     |
| `GET`    | `/api/direcciones`               | Listar IP registradas    |
| `POST`   | `/api/direcciones`               | Registrar IP             |
| `PUT`    | `/api/direcciones/:id`           | Actualizar IP            |
| `DELETE` | `/api/direcciones/:id`           | Eliminar IP              |
| `GET`    | `/api/usuarios`                  | Listar usuarios          |
| `POST`   | `/api/usuarios`                  | Crear usuario            |
| `PUT`    | `/api/usuarios/:id`              | Actualizar usuario       |
| `PUT`    | `/api/usuarios/:id/password`     | Cambiar contraseña       |
| `DELETE` | `/api/usuarios/:id`              | Eliminar usuario         |
| `GET`    | `/api/auditoria`                 | Consultar auditoría      |

Las rutas, excepto `/api/salud` y `/api/auth/login`, requieren:

```http
Authorization: Bearer TOKEN_JWT
```

## Pruebas rápidas

API directa:

```bash
curl http://127.0.0.1:3000/api/salud
```

API mediante Nginx:

```bash
curl http://IP_DEL_SERVIDOR/api/salud
```

Respuesta esperada:

```json
{ "estado": "correcto", "servicio": "API Inventario de IP" }
```

## Actualización desde GitHub

Desde el directorio clonado:

```bash
git pull
npm ci
npm ci --prefix backend
VITE_API_URL=/api npm run build
sudo rsync -a --delete dist/ /var/www/inventario-ips/
sudo chown -R www-data:www-data /var/www/inventario-ips
sudo systemctl restart inventario-ips
sudo systemctl reload nginx
```

No reemplazar `backend/.env` durante una actualización.

## Respaldo de MariaDB

Crear respaldo:

```bash
sudo mkdir -p /var/backups/inventario-ips
sudo mariadb-dump --single-transaction inventario_ips \
  | sudo tee /var/backups/inventario-ips/inventario_ips.sql >/dev/null
```

Restaurar un respaldo:

```bash
sudo mariadb inventario_ips \
  < /var/backups/inventario-ips/inventario_ips.sql
```

La restauración reemplaza o combina datos según el contenido del respaldo. Probarla primero en una base de pruebas.

## Seguridad

- Mantener el repositorio privado.
- No versionar `.env`, llaves SSH, respaldos ni certificados.
- No exponer MariaDB o Express directamente a la LAN.
- Usar contraseñas únicas de al menos 10 caracteres.
- Aplicar HTTPS antes de usar la aplicación fuera de una red controlada.
- Limitar el acceso al servidor mediante firewall.
- Revisar periódicamente la pestaña Auditoría.
- Mantener sistema operativo, Node.js, MariaDB y Nginx actualizados.

## Solución de problemas

### La aplicación no abre

```bash
sudo systemctl status nginx
sudo nginx -t
curl http://127.0.0.1/api/salud
```

### La API devuelve 502

```bash
sudo systemctl status inventario-ips
sudo journalctl -u inventario-ips -n 100 --no-pager
curl http://127.0.0.1:3000/api/salud
```

### El backend no conecta con MariaDB

```bash
sudo systemctl status mariadb
sudo journalctl -u mariadb -n 100 --no-pager
```

Revisar `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` en `backend/.env` sin compartir sus valores.

### El frontend muestra una versión anterior

```bash
VITE_API_URL=/api npm run build
sudo rsync -a --delete dist/ /var/www/inventario-ips/
sudo systemctl reload nginx
```

Después recargar el navegador con `Ctrl + F5`.

### Revisar puertos locales

```bash
sudo ss -lntp | grep -E ':80|:3000|:3306'
```

La configuración esperada es:

- Nginx escuchando en `0.0.0.0:80`.
- Express escuchando en `127.0.0.1:3000`.
- MariaDB escuchando únicamente de forma local.

## Desarrollo local

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend, en otra terminal:

```bash
npm install
npm run dev
```

Direcciones predeterminadas:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3000
```

## Licencia y uso

Proyecto interno. Definir una licencia antes de distribuirlo fuera de la organización.
