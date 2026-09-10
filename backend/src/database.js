import mariadb from "mariadb";
import "dotenv/config";

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  acquireTimeout: 10000,
  bigIntAsNumber: true,
});

export async function consultar(sql, parametros = []) {
  let conexion;

  try {
    conexion = await pool.getConnection();
    return await conexion.query(sql, parametros);
  } finally {
    if (conexion) {
      conexion.release();
    }
  }
}

export async function comprobarConexion() {
  const resultado = await consultar("SELECT DATABASE() AS baseDatos");
  return resultado[0];
}

export async function cerrarPool() {
  await pool.end();
}

export default pool;
