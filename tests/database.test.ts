import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';

describe('Database Operations', () => {
  let db: Database;
  const testDbPath = './test_database.sqlite';

  beforeAll(async () => {
    // Ensure test database is clean
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = await open({
      filename: testDbPath,
      driver: sqlite3.Database,
    });

    // Initialize schema
    await db.exec(`
      CREATE TABLE work_orders (
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

      CREATE TRIGGER trg_validate_work_order_qty
      BEFORE UPDATE ON work_orders
      FOR EACH ROW
      WHEN NEW.actual_quantity < 0
      BEGIN
        SELECT RAISE(ABORT, 'actual_quantity cannot be negative');
      END;
    `);
  });

  afterAll(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Work Orders CRUD', () => {
    it('should create a new work order', async () => {
      const order = {
        order_number: 'WO-001',
        device_id: 'dev-01',
        product_name: 'Product A',
        target_quantity: 100,
        start_time: '2026-03-30T08:00:00Z',
        end_time: '2026-03-30T16:00:00Z',
        shift_id: 1
      };

      const result = await db.run(
        'INSERT INTO work_orders (order_number, device_id, product_name, target_quantity, start_time, end_time, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [order.order_number, order.device_id, order.product_name, order.target_quantity, order.start_time, order.end_time, order.shift_id]
      );

      expect(result.lastID).toBe(1);
    });

    it('should read a work order', async () => {
      const order = await db.get('SELECT * FROM work_orders WHERE order_number = ?', ['WO-001']);
      expect(order).toBeDefined();
      expect(order.product_name).toBe('Product A');
    });

    it('should update a work order', async () => {
      await db.run('UPDATE work_orders SET actual_quantity = ? WHERE order_number = ?', [50, 'WO-001']);
      const order = await db.get('SELECT actual_quantity FROM work_orders WHERE order_number = ?', ['WO-001']);
      expect(order.actual_quantity).toBe(50);
    });

    it('should enforce data validation constraints (trigger)', async () => {
      await expect(
        db.run('UPDATE work_orders SET actual_quantity = ? WHERE order_number = ?', [-10, 'WO-001'])
      ).rejects.toThrow('actual_quantity cannot be negative');
    });

    it('should enforce unique constraint', async () => {
      await expect(
        db.run(
          'INSERT INTO work_orders (order_number, device_id, product_name, target_quantity, start_time, end_time, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['WO-001', 'dev-02', 'Product B', 200, '2026-03-30T08:00:00Z', '2026-03-30T16:00:00Z', 1]
        )
      ).rejects.toThrow('UNIQUE constraint failed');
    });

    it('should delete a work order', async () => {
      await db.run('DELETE FROM work_orders WHERE order_number = ?', ['WO-001']);
      const order = await db.get('SELECT * FROM work_orders WHERE order_number = ?', ['WO-001']);
      expect(order).toBeUndefined();
    });
  });
});
