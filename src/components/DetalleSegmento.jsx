import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  LoaderCircle,
  Network,
  Router,
  X,
} from "lucide-react";
import { listarDireccionesSegmento } from "../services/api";

function DetalleSegmento({
  segmentoId,
  cerrar,
  asignarDireccion,
  puedeAsignar,
}) {
  const [detalle, setDetalle] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargarDetalle(numeroPagina) {
    setCargando(true);
    setError("");

    try {
      const resultado = await listarDireccionesSegmento(
        segmentoId,
        numeroPagina,
      );

      setDetalle(resultado);
      setPagina(numeroPagina);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDetalle(1);
  }, [segmentoId]);

  return (
    <div className="fondo-modal" onMouseDown={cerrar}>
      <section
        className="modal modal-segmento-detalle"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <header className="modal-encabezado">
          <div>
            <h2>Direcciones del segmento</h2>
            <p>Consulta las direcciones asignadas y disponibles.</p>
          </div>

          <button
            type="button"
            className="boton-cerrar"
            onClick={cerrar}
            aria-label="Cerrar"
          >
            <X size={21} />
          </button>
        </header>

        {cargando && !detalle ? (
          <div className="estado-vacio">
            <LoaderCircle className="girando" size={42} />
            <h2>Cargando segmento</h2>
          </div>
        ) : error ? (
          <div className="estado-vacio">
            <Network size={42} />
            <h2>No fue posible consultar el segmento</h2>
            <p>{error}</p>

            <button
              className="boton-primario"
              onClick={() => cargarDetalle(pagina)}
            >
              Intentar nuevamente
            </button>
          </div>
        ) : (
          <>
            <div className="detalle-segmento-contenido">
              <section className="cabecera-segmento">
                <div className="icono-segmento">
                  <Network size={26} />
                </div>

                <div>
                  <h3>{detalle.segmento.nombre}</h3>
                  <strong>{detalle.segmento.cidr}</strong>
                  <span>{detalle.segmento.ubicacion}</span>
                </div>

                {detalle.segmento.vlan && (
                  <span className="etiqueta-vlan">
                    VLAN {detalle.segmento.vlan}
                  </span>
                )}
              </section>

              <div className="datos-red">
                <article>
                  <span>Dirección de red</span>
                  <strong>{detalle.segmento.direccionRed}</strong>
                </article>

                <article>
                  <span>Gateway</span>
                  <strong>{detalle.segmento.gateway || "Sin definir"}</strong>
                </article>

                <article>
                  <span>Broadcast</span>
                  <strong>{detalle.segmento.broadcast}</strong>
                </article>
              </div>

              <div className="resumen-direcciones">
                <article>
                  <span>Capacidad</span>
                  <strong>
                    {detalle.resumen.capacidad.toLocaleString("es-MX")}
                  </strong>
                </article>

                <article>
                  <span>Registradas</span>
                  <strong>{detalle.resumen.registradas}</strong>
                </article>

                <article>
                  <span>Disponibles</span>
                  <strong>
                    {detalle.resumen.disponibles.toLocaleString("es-MX")}
                  </strong>
                </article>
              </div>

              <div className="leyenda-direcciones">
                <span>
                  <i className="indicador disponible" />
                  Disponible
                </span>

                <span>
                  <i className="indicador ocupada" />
                  En uso
                </span>

                <span>
                  <i className="indicador reservada" />
                  Reservada
                </span>

                <span>
                  <Router size={15} />
                  Gateway
                </span>
              </div>

              <section className="rejilla-direcciones">
                {detalle.direcciones.map((direccion) => (
                  <article
                    key={direccion.ip}
                    className={`tarjeta-direccion ${
                      direccion.disponible
                        ? "direccion-disponible"
                        : direccion.tipo === "Gateway"
                          ? "direccion-gateway"
                          : "direccion-ocupada"
                    }`}
                  >
                    <div className="tarjeta-direccion-cabecera">
                      <strong>{direccion.ip}</strong>

                      <span>
                        {direccion.tipo === "Gateway"
                          ? "Gateway"
                          : direccion.estado}
                      </span>
                    </div>

                    {direccion.registro ? (
                      <div className="datos-asignacion">
                        <strong>{direccion.registro.dispositivo}</strong>

                        <span>
                          {direccion.registro.hostname || "Sin hostname"}
                        </span>

                        <small>
                          {direccion.registro.responsable || "Sin responsable"}
                        </small>
                      </div>
                    ) : direccion.disponible && puedeAsignar ? (
                      <button
                        type="button"
                        onClick={() => asignarDireccion(direccion.ip)}
                      >
                        <CirclePlus size={15} />
                        Asignar
                      </button>
                    ) : direccion.disponible ? (
                      <div className="datos-asignacion">
                        <span>Dirección disponible</span>
                      </div>
                    ) : (
                      <div className="datos-asignacion">
                        <span>
                          Dirección reservada para la puerta de enlace
                        </span>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </div>

            {detalle.paginacion.totalPaginas > 1 && (
              <footer className="paginacion-segmento">
                <button
                  className="boton-secundario"
                  disabled={pagina === 1 || cargando}
                  onClick={() => cargarDetalle(pagina - 1)}
                >
                  <ChevronLeft size={17} />
                  Anterior
                </button>

                <span>
                  Página {pagina} de {detalle.paginacion.totalPaginas}
                </span>

                <button
                  className="boton-secundario"
                  disabled={
                    pagina === detalle.paginacion.totalPaginas || cargando
                  }
                  onClick={() => cargarDetalle(pagina + 1)}
                >
                  Siguiente
                  <ChevronRight size={17} />
                </button>
              </footer>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default DetalleSegmento;
