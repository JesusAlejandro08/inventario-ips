import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";

import { mkdir, open, readdir, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const DIRECTORIO_RESPALDOS =
  process.env.BACKUP_DIR || "/var/backups/inventario-ips";

const SCRIPT_RESTAURACION = "/usr/local/lib/inventario-ips/restore-db.sh";

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

function crearError(mensaje, status = 500) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function obtenerRutaSegura(nombre) {
  if (!validarNombre(nombre)) {
    throw crearError("El nombre del respaldo no es válido.", 400);
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
    let terminado = false;

    proceso.stderr.on("data", (datos) => {
      errores += datos.toString();

      if (errores.length > 10000) {
        errores = errores.slice(-10000);
      }
    });

    const comprimir = createGzip({
      level: 9,
    });

    const destino = createWriteStream(archivo, {
      mode: 0o600,
    });

    const escritura = pipeline(proceso.stdout, comprimir, destino);

    proceso.on("error", (error) => {
      if (!terminado) {
        terminado = true;
        reject(error);
      }
    });

    proceso.on("close", async (codigo) => {
      if (terminado) return;

      try {
        await escritura;

        if (codigo !== 0) {
          throw new Error(
            errores.trim() || `mariadb-dump terminó con código ${codigo}.`,
          );
        }

        terminado = true;
        resolve();
      } catch (error) {
        terminado = true;
        reject(error);
      }
    });
  });
}

function ejecutarRestauracion(nombre) {
  return new Promise((resolve, reject) => {
    const proceso = spawn("sudo", ["-n", SCRIPT_RESTAURACION, nombre], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let salida = "";
    let errores = "";
    let terminado = false;

    proceso.stdout.on("data", (datos) => {
      salida += datos.toString();

      if (salida.length > 10000) {
        salida = salida.slice(-10000);
      }
    });

    proceso.stderr.on("data", (datos) => {
      errores += datos.toString();

      if (errores.length > 10000) {
        errores = errores.slice(-10000);
      }
    });

    proceso.on("error", (error) => {
      if (!terminado) {
        terminado = true;
        reject(error);
      }
    });

    proceso.on("close", (codigo) => {
      if (terminado) return;

      terminado = true;

      if (codigo !== 0) {
        reject(
          new Error(
            errores.trim() ||
              salida.trim() ||
              `La restauración terminó con código ${codigo}.`,
          ),
        );

        return;
      }

      resolve(salida.trim());
    });
  });
}
async function validarArchivoGzip(archivo) {
  const descriptor = await open(archivo, "r");

  try {
    const cabecera = Buffer.alloc(2);

    const { bytesRead } = await descriptor.read(
      cabecera,
      0,
      cabecera.length,
      0,
    );

    /*
     * Todo archivo gzip debe comenzar con
     * los bytes 1F 8B.
     */
    if (bytesRead !== 2 || cabecera[0] !== 0x1f || cabecera[1] !== 0x8b) {
      throw crearError(
        "El archivo seleccionado no es un respaldo gzip válido.",
        400,
      );
    }
  } finally {
    await descriptor.close();
  }
}
export async function importarRespaldo(req, res, next) {
  let archivoTemporal;
  let archivoDestino;

  try {
    if (!req.file) {
      throw crearError("Debes seleccionar un archivo .sql.gz.", 400);
    }

    archivoTemporal = req.file.path;

    if (!req.file.originalname.toLowerCase().endsWith(".sql.gz")) {
      throw crearError(
        "Solamente se permiten respaldos con extensión .sql.gz.",
        400,
      );
    }

    await validarArchivoGzip(archivoTemporal);

    const informacion = await stat(archivoTemporal);

    if (informacion.size === 0) {
      throw crearError("El respaldo seleccionado está vacío.", 400);
    }

    await mkdir(DIRECTORIO_RESPALDOS, {
      recursive: true,
      mode: 0o750,
    });

    const nombre = `inventario_ips-${fechaArchivo()}.sql.gz`;

    archivoDestino = path.join(DIRECTORIO_RESPALDOS, nombre);

    /*
     * Se copia mediante streams porque /tmp y
     * /var/backups podrían estar en sistemas
     * de archivos diferentes.
     */
    await pipeline(
      createReadStream(archivoTemporal),
      createWriteStream(archivoDestino, {
        mode: 0o600,
        flags: "wx",
      }),
    );

    await unlink(archivoTemporal).catch(() => {});

    archivoTemporal = null;

    res.status(201).json({
      mensaje: "Respaldo importado correctamente.",
      respaldo: {
        nombre,
        tamano: informacion.size,
        creadoEn: new Date().toISOString(),
        nombreOriginal: req.file.originalname,
      },
    });
  } catch (error) {
    if (archivoTemporal) {
      await rm(archivoTemporal, {
        force: true,
      }).catch(() => {});
    }

    if (archivoDestino) {
      await rm(archivoDestino, {
        force: true,
      }).catch(() => {});
    }

    next(error);
  }
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
      await rm(archivo, {
        force: true,
      }).catch(() => {});
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
            creadoEn: informacion.mtime.toISOString(),
          };
        }),
    );

    respaldos.sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

    res.json({
      respaldos,
    });
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

export async function restaurarRespaldo(req, res, next) {
  try {
    const confirmacion = req.body?.confirmacion;

    if (confirmacion !== "RESTAURAR") {
      return res.status(400).json({
        mensaje: "Debes escribir RESTAURAR para confirmar.",
      });
    }

    const nombre = req.params.nombre;
    const archivo = obtenerRutaSegura(nombre);

    await stat(archivo);

    const salida = await ejecutarRestauracion(nombre);

    res.json({
      mensaje: "La base de datos fue restaurada correctamente.",
      nombre,
      resultado: salida,
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
