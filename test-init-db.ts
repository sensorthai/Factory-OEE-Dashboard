import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function initDb() {
  console.log("Initializing database...");
  const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      device_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      target_quantity INTEGER NOT NULL,
      actual_quantity INTEGER DEFAULT 0,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      shift_id INTEGER NOT NULL,
      status TEXT DEFAULT 'planned',
      priority TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Database initialized successfully");
  await db.close();
}

initDb().catch(err => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});
