import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import { importarDireccionesCsv } from "../services/api";

function normalizarEncabezado(valor) {
  return String(valor ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\s+/g, " ");
}

function analizarCsv(contenido) {
  const filas = [];
  let fila = [];
  let celda = "";
  let entreComillas = false;

  for (let indice = 0; indice < contenido.length; indice += 1) {
    const caracter = contenido[indice];
    const siguiente = contenido[indice + 1];

    if (caracter === '"') {
      if (entreComillas && siguiente === '"') {
        celda += '"';
        indice += 1;
      } else {
        entreComillas = !entreComillas;
      }

      continue;
    }

    if (caracter === "," && !entreComillas) {
      fila.push(celda);
      celda = "";
      continue;
    }

    if (
      (caracter === "\n" || caracter === "\r") &&
      !entreComillas
    ) {
      if (caracter === "\r" && siguiente === "\n") {
        indice += 1;
      }

      fila.push(celda);

      if (fila.some((valor) => valor.trim() !== "")) {
        filas.push(fila);
      }

      fila = [];
      celda = "";
      continue;
    }

    celda += caracter;
  }

  fila.push(celda);

  if (fila.some((valor) => valor.trim() !== "")) {
    filas.push(fila);
  }

  return filas;
}

function encontrarValor(registro, nombres) {
  for (const nombre of nombres) {
    const clave = normalizarEncabezado(nombre);

    if (Object.hasOwn(registro, clave)) {
      return String(registro[clave] ?? "").trim();
    }
  }

  return "";
}

function convertirRegistros(contenido, segmentos) {
  const filas = analizarCsv(contenido);

  if (filas.length < 2) {
    throw new Error(
      "El CSV debe contener encabezados y al menos un registro.",
    );
  }

  const encabezados = filas[0].map(normalizarEncabezado);

  if (
    !encabezados.includes("direccion ip") &&
    !encabezados.includes("ip")
  ) {
    throw new Error(
      'El CSV debe contener la columna "Dirección IP" o "IP".',
    );
  }

  return filas.slice(1).map((valores) => {
    const registro = {};

    encabezados.forEach((encabezado, indice) => {
      registro[encabezado] = valores[indice] ?? "";
    });

    const segmentoIdCsv = encontrarValor(registro, [
      "segmentoId",
      "segmento id",
      "id segmento",
    ]);

    const nombreSegmento = encontrarValor(registro, [
      "segmento",
      "nombre segmento",
    ]);

    const cidr = encontrarValor(registro, [
      "cidr",
      "red",
    ]);

    let segmentoId = segmentoIdCsv;

    if (!segmentoId) {
      const segmentoEncontrado = segmentos.find(
        (segmento) =>
          String(segmento.cidr).toLowerCase() ===
            cidr.toLowerCase() ||
          String(segmento.nombre).toLowerCase() ===
            nombreSegmento.toLowerCase(),
      );

      segmentoId = segmentoEncontrado
        ? String(segmentoEncontrado.id)
        : "";
    }

    return {
      segmentoId,
      ip: encontrarValor(registro, [
        "Dirección IP",
        "IP",
        "direccion_ip",
      ]),
      hostname: encontrarValor(registro, [
        "Hostname",
        "Nombre de host",
      ]),
      dispositivo: encontrarValor(registro, [
        "Dispositivo",
        "Equipo",
      ]),
      ubicacion: encontrarValor(registro, [
        "Ubicación",
        "Ubicacion",
      ]),
      responsable: encontrarValor(registro, [
        "Responsable",
      ]),
      estado:
        encontrarValor(registro, ["Estado"]) ||
        "Disponible",
      observaciones: encontrarValor(registro, [
        "Observaciones",
        "Descripción",
        "Descripcion",
      ]),
    };
  });
}

function ModalImportarCsv({
  segmentos,
  cerrar,
  alImportar,
}) {
  const selectorArchivo = useRef(null);

  const [archivoNombre, setArchivoNombre] =
    useState("");
  const [registros, setRegistros] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [validando, setValidando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState("");

  async function seleccionarArchivo(evento) {
    const archivo = evento.target.files?.[0];

    setResultado(null);
    setRegistros([]);
    setError("");

    if (!archivo) {
      setArchivoNombre("");
      return;
    }

    if (!archivo.name.toLowerCase().endsWith(".csv")) {
      setArchivoNombre("");
      setError("Selecciona un archivo con extensión .csv.");
      evento.target.value = "";
      return;
    }

    if (archivo.size > 2 * 1024 * 1024) {
      setArchivoNombre("");
      setError("El archivo no puede superar 2 MB.");
      evento.target.value = "";
      return;
    }

    setArchivoNombre(archivo.name);
    setValidando(true);

    try {
      const contenido = await archivo.text();
      const registrosConvertidos =
        convertirRegistros(contenido, segmentos);

      if (registrosConvertidos.length > 500) {
        throw new Error(
          "El archivo contiene más de 500 registros.",
        );
      }

      const validacion = await importarDireccionesCsv(
        registrosConvertidos,
        false,
      );

      setRegistros(registrosConvertidos);
      setResultado(validacion);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setValidando(false);
    }
  }

  async function confirmarImportacion() {
    if (!resultado || resultado.invalidos > 0) {
      return;
    }

    const confirmado = window.confirm(
      `¿Importar ${resultado.validos} direcciones IP?`,
    );

    if (!confirmado) return;

    setImportando(true);
    setError("");

    try {
      const respuesta = await importarDireccionesCsv(
        registros,
        true,
      );

      await alImportar(respuesta.mensaje);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);

      if (errorSolicitud.registros) {
        setResultado(errorSolicitud);
      }
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="fondo-modal" onMouseDown={cerrar}>
      <section
        className="modal modal-importar-csv"
        onMouseDown={(evento) =>
          evento.stopPropagation()
        }
      >
        <header className="modal-encabezado">
          <div>
            <h2>Importar direcciones desde CSV</h2>
            <p>
              Valida los registros antes de guardarlos
              en MariaDB.
            </p>
          </div>

          <button
            type="button"
            className="boton-cerrar"
            onClick={cerrar}
            aria-label="Cerrar"
            disabled={importando}
          >
            <X size={21} />
          </button>
        </header>

        <div className="importacion-contenido">
          <input
            ref={selectorArchivo}
            type="file"
            accept=".csv,text/csv"
            onChange={seleccionarArchivo}
            hidden
          />

          <button
            type="button"
            className="selector-csv"
            onClick={() =>
              selectorArchivo.current?.click()
            }
            disabled={validando || importando}
          >
            {validando ? (
              <LoaderCircle
                className="girando"
                size={30}
              />
            ) : (
              <FileSpreadsheet size={30} />
            )}

            <span>
              <strong>
                {validando
                  ? "Validando archivo..."
                  : "Seleccionar archivo CSV"}
              </strong>

              <small>
                {archivoNombre ||
                  "Máximo 500 registros y 2 MB"}
              </small>
            </span>
          </button>

          <div className="ayuda-importacion">
            <strong>Columnas aceptadas</strong>
            <p>
              Dirección IP, Segmento o CIDR,
              Hostname, Dispositivo, Ubicación,
              Responsable, Estado y Observaciones.
            </p>
          </div>

          {error && (
            <div className="alerta-error">
              <AlertTriangle size={19} />
              <span>{error}</span>
            </div>
          )}

          {resultado && (
            <>
              <div className="resumen-importacion">
                <article>
                  <span>Total</span>
                  <strong>{resultado.total}</strong>
                </article>

                <article className="resumen-valido">
                  <span>Válidos</span>
                  <strong>{resultado.validos}</strong>
                </article>

                <article className="resumen-invalido">
                  <span>Con errores</span>
                  <strong>{resultado.invalidos}</strong>
                </article>
              </div>

              <div className="contenedor-tabla tabla-importacion">
                <table>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Dirección IP</th>
                      <th>Segmento</th>
                      <th>Dispositivo</th>
                      <th>Estado</th>
                      <th>Validación</th>
                    </tr>
                  </thead>

                  <tbody>
                    {resultado.registros
                      .slice(0, 100)
                      .map((registro) => (
                        <tr key={registro.fila}>
                          <td>{registro.fila}</td>
                          <td>
                            <strong className="direccion-ip">
                              {registro.ip || "Sin IP"}
                            </strong>
                          </td>
                          <td>
                            {registro.segmento ||
                              registro.segmentoId ||
                              "No encontrado"}
                          </td>
                          <td>
                            {registro.dispositivo ||
                              "Sin dispositivo"}
                          </td>
                          <td>{registro.estado}</td>
                          <td>
                            {registro.valido ? (
                              <span className="validacion-correcta">
                                <CheckCircle2 size={16} />
                                Correcto
                              </span>
                            ) : (
                              <div className="errores-fila">
                                {registro.errores.map(
                                  (mensaje) => (
                                    <span key={mensaje}>
                                      {mensaje}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {resultado.registros.length > 100 && (
                <p className="aviso-importacion">
                  Se muestran los primeros 100
                  registros de {resultado.total}.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="acciones-modal">
          <button
            type="button"
            className="boton-secundario"
            onClick={cerrar}
            disabled={importando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="boton-primario"
            onClick={confirmarImportacion}
            disabled={
              importando ||
              !resultado ||
              resultado.invalidos > 0 ||
              resultado.validos === 0
            }
          >
            {importando ? (
              <LoaderCircle
                className="girando"
                size={18}
              />
            ) : (
              <Upload size={18} />
            )}

            {importando
              ? "Importando..."
              : "Confirmar importación"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ModalImportarCsv;
