import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { listarAuditoria } from "../services/api";

function formatearFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function PanelAuditoria() {
  const [resultado, setResultado] = useState({
    registros: [],
    paginacion: { pagina: 1, totalPaginas: 1, total: 0 },
  });
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState("");
  const [entidad, setEntidad] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar(numeroPagina = pagina) {
    setCargando(true);
    setError("");

    try {
      const datos = await listarAuditoria({
        pagina: numeroPagina,
        limite: 50,
        accion,
        entidad,
      });
      setResultado(datos);
      setPagina(numeroPagina);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar(1);
  }, [accion, entidad]);

  return (
    <section className="panel panel-auditoria">
      <div className="encabezado-panel-admin">
        <div>
          <h2>Bitácora de auditoría</h2>
          <p>{resultado.paginacion.total} eventos registrados.</p>
        </div>

        <button
          className="boton-secundario"
          onClick={() => cargar(pagina)}
          disabled={cargando}
        >
          <RefreshCw className={cargando ? "girando" : ""} size={17} />
          Actualizar
        </button>
      </div>

      <div className="filtros-auditoria">
        <select value={accion} onChange={(e) => setAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          <option value="INICIAR_SESION">Inicio de sesión</option>
          <option value="CREAR">Creación</option>
          <option value="ACTUALIZAR">Actualización</option>
          <option value="ELIMINAR">Eliminación</option>
        </select>

        <select value={entidad} onChange={(e) => setEntidad(e.target.value)}>
          <option value="">Todas las entidades</option>
          <option value="sesion">Sesión</option>
          <option value="segmento">Segmento</option>
          <option value="direccion_ip">Dirección IP</option>
          <option value="usuario">Usuario</option>
        </select>
      </div>

      {error && <div className="alerta-error alerta-en-panel">{error}</div>}

      {cargando && resultado.registros.length === 0 ? (
        <div className="estado-vacio">
          <LoaderCircle className="girando" size={42} />
          <h2>Cargando auditoría</h2>
        </div>
      ) : resultado.registros.length === 0 ? (
        <div className="estado-vacio">
          <FileClock size={42} />
          <h2>No hay eventos para mostrar</h2>
          <p>Modifica los filtros o realiza una operación en el inventario.</p>
        </div>
      ) : (
        <div className="contenedor-tabla">
          <table className="tabla-auditoria">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Registro</th>
                <th>IP de origen</th>
              </tr>
            </thead>
            <tbody>
              {resultado.registros.map((registro) => (
                <tr key={registro.id}>
                  <td>{formatearFecha(registro.creadoEn)}</td>
                  <td>
                    <strong>{registro.usuarioNombre}</strong>
                    <span className="dato-secundario">
                      {registro.usuario
                        ? `@${registro.usuario}`
                        : "Cuenta eliminada"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`accion-auditoria accion-${registro.accion.toLowerCase()}`}
                    >
                      {registro.accion.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{registro.entidad.replaceAll("_", " ")}</td>
                  <td>{registro.entidadId || "—"}</td>
                  <td className="direccion-ip">
                    {registro.direccionIp || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultado.paginacion.totalPaginas > 1 && (
        <footer className="paginacion-segmento">
          <button
            className="boton-secundario"
            disabled={pagina === 1 || cargando}
            onClick={() => cargar(pagina - 1)}
          >
            <ChevronLeft size={17} /> Anterior
          </button>
          <span>
            Página {pagina} de {resultado.paginacion.totalPaginas}
          </span>
          <button
            className="boton-secundario"
            disabled={pagina === resultado.paginacion.totalPaginas || cargando}
            onClick={() => cargar(pagina + 1)}
          >
            Siguiente <ChevronRight size={17} />
          </button>
        </footer>
      )}
    </section>
  );
}

export default PanelAuditoria;
