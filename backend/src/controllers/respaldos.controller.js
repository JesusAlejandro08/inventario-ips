import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat, unlink } from "node:fs/promises";
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

function validarNombre(nombre) {
  return /^inventario_ips-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql\.gz$/.test(
    nombre,
  );
}

function obtenerRutaSegura(nombre) {
  if (!validarNombre(nombre)) {
    const error = new Error("El nombre del respaldo no es válido.");

    error.status = 400;
    throw error;
  }

  return path.join(DIRECTORIO_RESPALDOS, nombre);
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

export async function listarRespaldos(req, res, next) {
  try {
    await mkdir(DIRECTORIO_RESPALDOS, {
      recursive: true,
      mode: 0o750,
    });

    const entradas = await readdir(DIRECTORIO_RESPALDOS, {
      withFileTypes: true,
    });

    const respaldos = await Promise.all(
      entradas
        .filter((entrada) => entrada.isFile() && validarNombre(entrada.name))
        .map(async (entrada) => {
          const ruta = path.join(DIRECTORIO_RESPALDOS, entrada.name);

          const informacion = await stat(ruta);

          return {
            nombre: entrada.name,
            tamano: informacion.size,
            creadoEn: informacion.mtime,
          };
        }),
    );

    respaldos.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

    res.json({ respaldos });
  } catch (error) {
    next(error);
  }
}

export async function descargarRespaldo(req, res, next) {
  try {
    const archivo = obtenerRutaSegura(req.params.nombre);

    await stat(archivo);

    res.download(archivo, req.params.nombre, (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        mensaje: "El respaldo no existe.",
      });
    }

    next(error);
  }
}

export async function eliminarRespaldo(req, res, next) {
  try {
    const archivo = obtenerRutaSegura(req.params.nombre);

    await unlink(archivo);

    await unlink(`${archivo}.sha256`).catch(() => {});

    res.json({
      mensaje: "Respaldo eliminado correctamente.",
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        mensaje: "El respaldo no existe.",
      });
    }

    next(error);
  }
}
