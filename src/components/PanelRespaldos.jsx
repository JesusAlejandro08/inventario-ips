import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  crearRespaldoBaseDatos,
  descargarRespaldo,
  eliminarRespaldo,
  listarRespaldos,
  restaurarRespaldo,
} from "../services/api";

function formatoTamano(bytes) {
  if (!bytes) return "0 KB";

  const unidades = ["B", "KB", "MB", "GB"];
  const indice = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    unidades.length - 1,
  );

  return `${(bytes / 1024 ** indice).toFixed(
    indice === 0 ? 0 : 1,
  )} ${unidades[indice]}`;
}

function guardarArchivo({ archivo, nombre }) {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

function PanelRespaldos() {
  const [respaldos, setRespaldos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState("");
  const [restaurando, setRestaurando] = useState("");
  const [eliminando, setEliminando] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function cargarRespaldos() {
    setCargando(true);
    setError("");

    try {
      const resultado = await listarRespaldos();
      setRespaldos(resultado.respaldos || []);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarRespaldos();
  }, []);

  async function generar() {
    setGenerando(true);
    setMensaje("");
    setError("");

    try {
      const resultado = await crearRespaldoBaseDatos();

      guardarArchivo(resultado);

      setMensaje(`Respaldo ${resultado.nombre} creado correctamente.`);

      await cargarRespaldos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(nombre) {
    setDescargando(nombre);
    setMensaje("");
    setError("");

    try {
      const resultado = await descargarRespaldo(nombre);

      guardarArchivo(resultado);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setDescargando("");
    }
  }

  async function restaurar(nombre) {
    const primeraConfirmacion = window.confirm(
      `¿Restaurar ${nombre}? Los datos actuales serán reemplazados.`,
    );

    if (!primeraConfirmacion) return;

    const confirmacion = window.prompt("Escribe RESTAURAR para confirmar:");

    if (confirmacion !== "RESTAURAR") {
      setMensaje("");
      setError(
        "La restauración fue cancelada porque la confirmación no coincide.",
      );
      return;
    }

    setRestaurando(nombre);
    setMensaje("");
    setError("");

    try {
      await restaurarRespaldo(nombre, confirmacion);

      setMensaje(
        "Base de datos restaurada correctamente. Recargando el sistema...",
      );

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setRestaurando("");
    }
  }

  async function eliminar(nombre) {
    const confirmado = window.confirm(
      `¿Eliminar permanentemente el respaldo ${nombre}?`,
    );

    if (!confirmado) return;

    setEliminando(nombre);
    setMensaje("");
    setError("");

    try {
      await eliminarRespaldo(nombre);

      setMensaje("Respaldo eliminado correctamente.");

      await cargarRespaldos();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setEliminando("");
    }
  }

  const operacionEnCurso =
    generando ||
    Boolean(descargando) ||
    Boolean(restaurando) ||
    Boolean(eliminando);

  return (
    <section className="panel panel-respaldos">
      <div className="respaldos-encabezado">
        <div className="respaldos-icono">
          <DatabaseBackup size={30} />
        </div>

        <div>
          <h2>Respaldos de la base de datos</h2>

          <p>Administra las copias de seguridad del inventario.</p>
        </div>

        <button
          type="button"
          className="boton-recargar"
          onClick={cargarRespaldos}
          disabled={cargando || operacionEnCurso}
        >
          <RefreshCw size={18} className={cargando ? "girando" : ""} />
          Actualizar
        </button>
      </div>

      <div className="respaldo-informacion">
        <ShieldCheck size={23} />

        <div>
          <strong>Almacenamiento protegido</strong>

          <p>
            Los respaldos se guardan en el servidor y solamente pueden
            administrarlos usuarios con rol Administrador.
          </p>
        </div>
      </div>

      {mensaje && <div className="mensaje-exito">{mensaje}</div>}

      {error && <div className="alerta-error">{error}</div>}

      <button
        type="button"
        className="boton-primario boton-respaldo"
        onClick={generar}
        disabled={operacionEnCurso}
      >
        {generando ? (
          <LoaderCircle className="girando" size={19} />
        ) : (
          <DatabaseBackup size={19} />
        )}

        {generando ? "Generando respaldo..." : "Crear y descargar respaldo"}
      </button>

      <div className="lista-respaldos">
        <h3>Respaldos almacenados</h3>

        {cargando ? (
          <div className="estado-respaldos">
            <LoaderCircle className="girando" size={30} />
            Cargando respaldos...
          </div>
        ) : respaldos.length === 0 ? (
          <div className="estado-respaldos">
            No existen respaldos almacenados.
          </div>
        ) : (
          <div className="contenedor-tabla">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Fecha</th>
                  <th>Tamaño</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {respaldos.map((respaldo) => (
                  <tr key={respaldo.nombre}>
                    <td>
                      <strong className="nombre-respaldo">
                        {respaldo.nombre}
                      </strong>
                    </td>

                    <td>
                      {new Date(respaldo.creadoEn).toLocaleString("es-MX")}
                    </td>

                    <td>{formatoTamano(respaldo.tamano)}</td>

                    <td>
                      <div className="acciones-respaldo">
                        <button
                          type="button"
                          title="Descargar respaldo"
                          aria-label={`Descargar ${respaldo.nombre}`}
                          onClick={() => descargar(respaldo.nombre)}
                          disabled={operacionEnCurso}
                        >
                          {descargando === respaldo.nombre ? (
                            <LoaderCircle className="girando" size={17} />
                          ) : (
                            <Download size={17} />
                          )}
                        </button>

                        <button
                          type="button"
                          className="boton-restaurar-respaldo"
                          title="Restaurar respaldo"
                          aria-label={`Restaurar ${respaldo.nombre}`}
                          onClick={() => restaurar(respaldo.nombre)}
                          disabled={operacionEnCurso}
                        >
                          {restaurando === respaldo.nombre ? (
                            <LoaderCircle className="girando" size={17} />
                          ) : (
                            <RotateCcw size={17} />
                          )}
                        </button>

                        <button
                          type="button"
                          className="boton-eliminar-respaldo"
                          title="Eliminar respaldo"
                          aria-label={`Eliminar ${respaldo.nombre}`}
                          onClick={() => eliminar(respaldo.nombre)}
                          disabled={operacionEnCurso}
                        >
                          {eliminando === respaldo.nombre ? (
                            <LoaderCircle className="girando" size={17} />
                          ) : (
                            <Trash2 size={17} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default PanelRespaldos;
