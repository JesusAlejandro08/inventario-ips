import "dotenv/config";
import app from "./app.js";
import { cerrarPool, comprobarConexion } from "./database.js";

const puerto = Number(process.env.PORT || 3000);

async function iniciarServidor() {
  try {
    const conexion = await comprobarConexion();

    console.log(`Conexión correcta con MariaDB: ${conexion.baseDatos}`);

    const servidor = app.listen(puerto, "127.0.0.1", () => {
      console.log(`API disponible en http://127.0.0.1:${puerto}`);
    });

    async function cerrarServidor() {
      console.log("\nCerrando servidor...");

      servidor.close(async () => {
        await cerrarPool();
        process.exit(0);
      });
    }

    process.on("SIGINT", cerrarServidor);
    process.on("SIGTERM", cerrarServidor);
  } catch (error) {
    console.error("No fue posible conectar con MariaDB:");
    console.error(error.message);
    process.exit(1);
  }
}

iniciarServidor();
