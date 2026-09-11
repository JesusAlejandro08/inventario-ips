import { useState } from "react";
import {
  DatabaseBackup,
  Download,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { crearRespaldoBaseDatos } from "../services/api";

function PanelRespaldos() {
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  async function generarRespaldo() {
    setGenerando(true);
    setMensaje("");
    setError("");

    try {
      const { archivo, nombre } =
        await crearRespaldoBaseDatos();

      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      URL.revokeObjectURL(url);

      setMensaje(
        `Respaldo ${nombre} creado y descargado correctamente.`,
      );
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <section className="panel panel-respaldos">
      <div className="respaldos-encabezado">
        <div className="respaldos-icono">
          <DatabaseBackup size={30} />
        </div>

        <div>
          <h2>Respaldos de la base de datos</h2>
          <p>
            Genera una copia comprimida de los segmentos,
            direcciones IP, usuarios y registros de auditoría.
          </p>
        </div>
      </div>

      <div className="respaldo-informacion">
        <ShieldCheck size={23} />

        <div>
          <strong>Respaldo protegido</strong>
          <p>
            La operación está disponible únicamente para
            administradores. El archivo se genera en el servidor
            y se descarga en formato SQL comprimido.
          </p>
        </div>
      </div>

      {mensaje && (
        <div className="mensaje-exito">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="alerta-error">
          {error}
        </div>
      )}

      <button
        type="button"
        className="boton-primario boton-respaldo"
        onClick={generarRespaldo}
        disabled={generando}
      >
        {generando ? (
          <LoaderCircle className="girando" size={19} />
        ) : (
          <Download size={19} />
        )}

        {generando
          ? "Generando respaldo..."
          : "Crear y descargar respaldo"}
      </button>
    </section>
  );
}

export default PanelRespaldos;
