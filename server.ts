import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THINGSBOARD_URL = (process.env.THINGSBOARD_URL || "https://iot1.wsa.cloud").replace(/\/$/, "");

async function initDb() {
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
      last_sync DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    INSERT OR IGNORE INTO shifts (id, name, start_time, end_time) VALUES 
    (1, 'Morning', '06:00', '14:00'),
    (2, 'Afternoon', '14:00', '22:00'),
    (3, 'Night', '22:00', '06:00');

    CREATE TABLE IF NOT EXISTS downtime_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      reason TEXT,
      start_time DATETIME,
      end_time DATETIME,
      duration_minutes INTEGER,
      category TEXT,
      type TEXT DEFAULT 'Unplanned',
      comments TEXT,
      root_cause TEXT
    );

    CREATE TABLE IF NOT EXISTS oee_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      availability REAL,
      performance REAL,
      quality REAL,
      oee_score REAL,
      shift_id INTEGER,
      product_name TEXT
    );

    CREATE TABLE IF NOT EXISTS device_config (
      device_id TEXT PRIMARY KEY,
      display_name TEXT,
      ideal_cycle_time REAL,
      location TEXT
    );

    CREATE TABLE IF NOT EXISTS production_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      target_quantity INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. alerts_history table
    CREATE TABLE IF NOT EXISTS alerts_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by INTEGER,
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_work_orders_device ON work_orders(device_id);
    CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
    CREATE INDEX IF NOT EXISTS idx_downtime_device_time ON downtime_events(device_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_oee_device_time ON oee_summaries(device_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_alerts_device_time ON alerts_history(device_id, timestamp);

    -- Views for common queries
    CREATE VIEW IF NOT EXISTS v_daily_oee AS
    SELECT 
      device_id,
      date(timestamp) as production_date,
      AVG(availability) as avg_availability,
      AVG(performance) as avg_performance,
      AVG(quality) as avg_quality,
      AVG(oee_score) as avg_oee
    FROM oee_summaries
    GROUP BY device_id, date(timestamp);

    CREATE VIEW IF NOT EXISTS v_downtime_summary AS
    SELECT 
      device_id,
      category,
      SUM(duration_minutes) as total_downtime_minutes,
      COUNT(*) as incident_count
    FROM downtime_events
    GROUP BY device_id, category;

    -- Triggers for data validation
    CREATE TRIGGER IF NOT EXISTS trg_validate_downtime_dates
    BEFORE INSERT ON downtime_events
    FOR EACH ROW
    WHEN NEW.end_time IS NOT NULL AND NEW.end_time <= NEW.start_time
    BEGIN
      SELECT RAISE(ABORT, 'end_time must be after start_time');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_validate_work_order_qty
    BEFORE UPDATE ON work_orders
    FOR EACH ROW
    WHEN NEW.actual_quantity < 0
    BEGIN
      SELECT RAISE(ABORT, 'actual_quantity cannot be negative');
    END;
  `);

  // Migration for existing databases
  const columns = await db.all("PRAGMA table_info(work_orders)");
  const hasLastSync = columns.some(c => c.name === "last_sync");
  if (!hasLastSync) {
    await db.exec("ALTER TABLE work_orders ADD COLUMN last_sync DATETIME");
  }

  const oeeColumns = await db.all("PRAGMA table_info(oee_summaries)");
  if (!oeeColumns.some(c => c.name === "shift_id")) {
    await db.exec("ALTER TABLE oee_summaries ADD COLUMN shift_id INTEGER");
  }
  if (!oeeColumns.some(c => c.name === "product_name")) {
    await db.exec("ALTER TABLE oee_summaries ADD COLUMN product_name TEXT");
  }

  const downtimeColumns = await db.all("PRAGMA table_info(downtime_events)");
  if (!downtimeColumns.some(c => c.name === "type")) {
    await db.exec("ALTER TABLE downtime_events ADD COLUMN type TEXT DEFAULT 'Unplanned'");
  }
  if (!downtimeColumns.some(c => c.name === "comments")) {
    await db.exec("ALTER TABLE downtime_events ADD COLUMN comments TEXT");
  }
  if (!downtimeColumns.some(c => c.name === "root_cause")) {
    await db.exec("ALTER TABLE downtime_events ADD COLUMN root_cause TEXT");
  }

  // Seed Data for testing
  const userCount = await db.get("SELECT COUNT(*) as count FROM users");
  if (userCount.count === 0) {
    await db.run("INSERT INTO users (username, password_hash, role) VALUES ('admin', 'hashed_pwd_placeholder', 'admin')");
    await db.run("INSERT INTO users (username, password_hash, role) VALUES ('operator1', 'hashed_pwd_placeholder', 'operator')");
  }

  const deviceCount = await db.get("SELECT COUNT(*) as count FROM device_config");
  if (deviceCount.count === 0) {
    await db.run("INSERT INTO device_config (device_id, display_name, ideal_cycle_time, location) VALUES ('cnc_machine_01', 'CNC Milling Machine', 45.5, 'Zone A')");
    await db.run("INSERT INTO device_config (device_id, display_name, ideal_cycle_time, location) VALUES ('packaging_line_02', 'Packaging Line 2', 12.0, 'Zone B')");
  }

  const alertCount = await db.get("SELECT COUNT(*) as count FROM alerts_history");
  if (alertCount.count === 0) {
    await db.run("INSERT INTO alerts_history (device_id, alert_type, message, severity) VALUES ('cnc_machine_01', 'Temperature', 'Spindle temperature high', 'critical')");
  }

  return db;
}

let tbToken: string | null = null;

async function getTbToken() {
  if (tbToken) return tbToken;
  
  const username = process.env.THINGSBOARD_USERNAME;
  const password = process.env.THINGSBOARD_PASSWORD;
  
  if (!username || !password) {
    return null;
  }

  try {
    console.log(`Attempting background ThingsBoard login to ${THINGSBOARD_URL}/api/auth/login with user: ${username}`);
    const response = await axios.post(`${THINGSBOARD_URL}/api/auth/login`, {
      username,
      password
    });
    tbToken = response.data.token;
    console.log("Background ThingsBoard login successful");
    return tbToken;
  } catch (error: any) {
    // Only log once to avoid spamming
    if (!getTbToken.hasOwnProperty('loggedError')) {
      const errorData = error.response?.data;
      console.error("Background TB login failed - check THINGSBOARD_USERNAME/PASSWORD in Settings", {
        status: error.response?.status,
        errorCode: errorData?.errorCode,
        errorMessage: errorData?.message,
        axiosMessage: error.message
      });
      (getTbToken as any).loggedError = true;
    }
    return null;
  }
}

async function syncTelemetry(db: any) {
  const token = await getTbToken();
  if (!token) return;

  try {
    const activeOrders = await db.all("SELECT * FROM work_orders WHERE status = 'in_progress'");
    if (activeOrders.length === 0) return;

    // Group by device_id to minimize API calls
    const deviceIds = [...new Set(activeOrders.map((o: any) => o.device_id))];

    for (const deviceId of deviceIds) {
      try {
        const response = await axios.get(
          `${THINGSBOARD_URL}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              "X-Authorization": `Bearer ${token}`
            },
            params: { keys: "count" }
          }
        );

        const countVal = response.data?.count?.[0]?.value;
        if (countVal !== undefined) {
          const actualCount = parseInt(countVal);
          await db.run(
            "UPDATE work_orders SET actual_quantity = ?, last_sync = CURRENT_TIMESTAMP WHERE device_id = ? AND status = 'in_progress'",
            [actualCount, deviceId]
          );
          console.log(`Synced telemetry for device ${deviceId}: ${actualCount}`);
        }
      } catch (err: any) {
        if (err.response?.status === 401 || err.response?.status === 400) {
          tbToken = null; // Reset token on auth error
        }
        console.error(`Failed to sync telemetry for device ${deviceId}`, err.message);
      }
    }
  } catch (error) {
    console.error("Telemetry sync task failed", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const db = await initDb();

  app.use(express.json());
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  const authMiddleware = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      // Verify token with ThingsBoard
      await axios.get(`${THINGSBOARD_URL}/api/auth/user`, {
        headers: { 
          Authorization: token,
          "X-Authorization": token
        }
      });
      next();
    } catch (error) {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  };

  // API Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const response = await axios.post(`${THINGSBOARD_URL}/api/auth/login`, req.body);
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal server error" });
    }
  });

  // Proxy ThingsBoard requests
  app.all("/api/tb/*", async (req, res) => {
    const tbPath = req.params[0];
    const token = req.headers.authorization;

    try {
      const headers: any = {};
      if (token) {
        headers.Authorization = token;
        headers["X-Authorization"] = token;
      }

      const response = await axios({
        method: req.method,
        url: `${THINGSBOARD_URL}/api/${tbPath}`,
        data: req.body,
        params: req.query,
        headers,
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal server error" });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const response = await axios.post(`${THINGSBOARD_URL}/api/auth/token`, req.body);
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { message: "Internal server error" });
    }
  });

  // Local SQLite Routes (Protected)
  app.get("/api/work-orders", authMiddleware, async (req, res) => {
    const orders = await db.all("SELECT * FROM work_orders ORDER BY start_time ASC");
    res.json(orders);
  });

  app.post("/api/work-orders", authMiddleware, async (req, res) => {
    const { order_number, device_id, product_name, target_quantity, start_time, end_time, shift_id, priority } = req.body;
    try {
      await db.run(
        "INSERT INTO work_orders (order_number, device_id, product_name, target_quantity, start_time, end_time, shift_id, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [order_number, device_id, product_name, target_quantity, start_time, end_time, shift_id, priority]
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/work-orders/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { 
      order_number, 
      device_id, 
      product_name, 
      target_quantity, 
      actual_quantity, 
      start_time, 
      end_time, 
      shift_id, 
      status, 
      priority 
    } = req.body;

    const fields = [];
    const values = [];

    if (order_number !== undefined) { fields.push("order_number = ?"); values.push(order_number); }
    if (device_id !== undefined) { fields.push("device_id = ?"); values.push(device_id); }
    if (product_name !== undefined) { fields.push("product_name = ?"); values.push(product_name); }
    if (target_quantity !== undefined) { fields.push("target_quantity = ?"); values.push(target_quantity); }
    if (actual_quantity !== undefined) { fields.push("actual_quantity = ?"); values.push(actual_quantity); }
    if (start_time !== undefined) { fields.push("start_time = ?"); values.push(start_time); }
    if (end_time !== undefined) { fields.push("end_time = ?"); values.push(end_time); }
    if (shift_id !== undefined) { fields.push("shift_id = ?"); values.push(shift_id); }
    if (status !== undefined) { fields.push("status = ?"); values.push(status); }
    if (priority !== undefined) { fields.push("priority = ?"); values.push(priority); }

    if (fields.length === 0) return res.json({ success: true });

    values.push(id);
    await db.run(
      `UPDATE work_orders SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  });

  app.delete("/api/work-orders/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    await db.run("DELETE FROM work_orders WHERE id = ?", [id]);
    res.json({ success: true });
  });

  app.get("/api/shifts", authMiddleware, async (req, res) => {
    const shifts = await db.all("SELECT * FROM shifts");
    res.json(shifts);
  });

  app.get("/api/reports/oee", authMiddleware, async (req, res) => {
    const { deviceId } = req.query;
    const reports = await db.all("SELECT * FROM oee_summaries WHERE device_id = ? ORDER BY timestamp DESC LIMIT 100", [deviceId]);
    res.json(reports);
  });

  app.post("/api/reports/oee", authMiddleware, async (req, res) => {
    const { device_id, availability, performance, quality, oee_score } = req.body;
    await db.run(
      "INSERT INTO oee_summaries (device_id, availability, performance, quality, oee_score) VALUES (?, ?, ?, ?, ?)",
      [device_id, availability, performance, quality, oee_score]
    );
    res.json({ success: true });
  });

  app.get("/api/planning", authMiddleware, async (req, res) => {
    const plans = await db.all("SELECT * FROM production_plans ORDER BY start_time DESC");
    res.json(plans);
  });

  app.post("/api/planning", authMiddleware, async (req, res) => {
    const { device_id, target_quantity, start_time, end_time } = req.body;
    await db.run(
      "INSERT INTO production_plans (device_id, target_quantity, start_time, end_time) VALUES (?, ?, ?, ?)",
      [device_id, target_quantity, start_time, end_time]
    );
    res.json({ success: true });
  });

  app.get("/api/downtime", authMiddleware, async (req, res) => {
    const events = await db.all("SELECT * FROM downtime_events ORDER BY start_time DESC");
    res.json(events);
  });

  app.post("/api/downtime", authMiddleware, async (req, res) => {
    const { device_id, reason, start_time, end_time, duration_minutes, category, type, comments, root_cause } = req.body;
    await db.run(
      "INSERT INTO downtime_events (device_id, reason, start_time, end_time, duration_minutes, category, type, comments, root_cause) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [device_id, reason, start_time, end_time, duration_minutes, category, type || 'Unplanned', comments || '', root_cause || '']
    );
    res.json({ success: true });
  });

  // Analytics Endpoints
  app.get("/api/analytics/oee-trends", authMiddleware, async (req, res) => {
    const { deviceId, period } = req.query; // period: day, week, month
    let groupBy = "strftime('%Y-%m-%d', timestamp)";
    if (period === "week") groupBy = "strftime('%Y-%W', timestamp)";
    if (period === "month") groupBy = "strftime('%Y-%m', timestamp)";

    const trends = await db.all(`
      SELECT 
        ${groupBy} as date,
        AVG(availability) as availability,
        AVG(performance) as performance,
        AVG(quality) as quality,
        AVG(oee_score) as oee
      FROM oee_summaries
      WHERE device_id = ?
      GROUP BY date
      ORDER BY date ASC
      LIMIT 30
    `, [deviceId]);
    res.json(trends);
  });

  app.get("/api/analytics/downtime-pareto", authMiddleware, async (req, res) => {
    const { deviceId } = req.query;
    const pareto = await db.all(`
      SELECT 
        reason,
        SUM(duration_minutes) as total_duration,
        COUNT(*) as frequency
      FROM downtime_events
      WHERE device_id = ?
      GROUP BY reason
      ORDER BY total_duration DESC
    `, [deviceId]);
    res.json(pareto);
  });

  app.get("/api/analytics/loss-analysis", authMiddleware, async (req, res) => {
    const { deviceId } = req.query;
    // Mocking loss analysis based on downtime and OEE if data is sparse
    // In a real app, this would be calculated from detailed telemetry
    const losses = [
      { name: "Breakdowns", value: Math.random() * 20 + 5 },
      { name: "Setup/Adjustments", value: Math.random() * 15 + 5 },
      { name: "Small Stops", value: Math.random() * 10 + 2 },
      { name: "Reduced Speed", value: Math.random() * 15 + 5 },
      { name: "Startup Rejects", value: Math.random() * 5 + 1 },
      { name: "Production Rejects", value: Math.random() * 5 + 1 },
    ];
    res.json(losses);
  });

  app.get("/api/analytics/summary", authMiddleware, async (req, res) => {
    const { deviceId } = req.query;
    const summary = await db.get(`
      SELECT 
        AVG(oee_score) as avg_oee,
        MAX(oee_score) as peak_oee,
        MIN(oee_score) as low_oee,
        SUM(availability)/COUNT(*) as avg_availability
      FROM oee_summaries
      WHERE device_id = ?
    `, [deviceId]);
    res.json(summary);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Start background sync
  setInterval(() => syncTelemetry(db), 10000);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
