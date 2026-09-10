import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const DIRECTORIO_RESPALDOS =
  process.env.BACKUP_DIR || "/var/backups/inventario-ips";

function fechaArchivo() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace("T", "_")
    .replace(/\.\d{3}Z$/, "");
}

function ejecutarDump(archivo) {
  return new Promise((resolve, reject) => {
    const argumentos = [
      `--host=${process.env.DB_HOST}`,
      `--port=${process.env.DB_PORT || 3306}`,
      `--user=${process.env.DB_USER}`,
      "--single-transaction",
      "--quick",
      "--routines",
      "--events",
      "--triggers",
      "--hex-blob",
      "--default-character-set=utf8mb4",
      "--databases",
      process.env.DB_NAME,
    ];

    const proceso = spawn("mariadb-dump", argumentos, {
      env: {
        ...process.env,
        MYSQL_PWD: process.env.DB_PASSWORD,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let errores = "";

    proceso.stderr.on("data", (datos) => {
      errores += datos.toString();
    });

    const comprimir = createGzip({ level: 9 });
    const destino = createWriteStream(archivo, {
      mode: 0o600,
    });

    const escritura = pipeline(proceso.stdout, comprimir, destino);

    proceso.on("error", reject);

    proceso.on("close", async (codigo) => {
      try {
        await escritura;

        if (codigo !== 0) {
          reject(
            new Error(
              errores.trim() || `mariadb-dump terminó con código ${codigo}.`,
            ),
          );
          return;
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function crearRespaldo(req, res, next) {
  let archivo;

  try {
    await mkdir(DIRECTORIO_RESPALDOS, {
      recursive: true,
      mode: 0o750,
    });

    const nombre = `inventario_ips-${fechaArchivo()}.sql.gz`;

    archivo = path.join(DIRECTORIO_RESPALDOS, nombre);

    await ejecutarDump(archivo);

    const informacion = await stat(archivo);

    if (informacion.size === 0) {
      throw new Error("El respaldo generado está vacío.");
    }

    res.download(archivo, nombre, (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    if (archivo) {
      await rm(archivo, { force: true }).catch(() => {});
    }

    next(error);
  }
}
