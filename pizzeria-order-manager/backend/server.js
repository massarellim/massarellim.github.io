import express from 'express';
import cors from 'cors';
import { printOrderEpson } from './printerEpson.js';
import { printFiscalReceiptCustom, closeDayCustom } from './printerCustom.js';
import { initDb, getDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Backend proxy is running' });
});

// --- CUSTOMERS API ---
app.get('/api/customers', async (req, res) => {
  try {
    const db = getDb();
    const customers = await db.all('SELECT * FROM customers ORDER BY name ASC');
    res.json(customers);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    const db = getDb();
    const result = await db.run(
      'INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)',
      [name || '', phone || '', address || '', notes || '']
    );
    res.json({ success: true, id: result.lastID });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    const db = getDb();
    await db.run(
      'UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?',
      [name || '', phone || '', address || '', notes || '', req.params.id]
    );
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const db = getDb();
    
    // Check if customer has associated orders
    const orderCount = await db.get('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?', [req.params.id]);
    if (orderCount.count > 0) {
      return res.status(400).json({ error: 'Impossibile eliminare: ci sono ordini associati a questo cliente.' });
    }

    await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORDERS API ---
app.get('/api/orders', async (req, res) => {
  try {
    const db = getDb();
    const orders = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(orders);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Print Kitchen/Order Ticket (Epson - Non Fiscal)
app.post('/api/print-ticket', async (req, res) => {
  try {
    const { orderItems, orderId, table, notes, customer } = req.body;
    await printOrderEpson({ orderItems, orderId, table, notes, customer });
    res.json({ success: true, message: 'Ticket printed to Epson' });
  } catch (err) {
    console.error('Error printing ticket:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save Order to Database (NO Fiscal Print)
app.post('/api/save-order', async (req, res) => {
  try {
    const { editingOrderId, orderItems, total, paymentType, customer, orderType, deliveryTime } = req.body;
    const customerId = customer ? customer.id : null;
    const db = getDb();

    if (editingOrderId) {
      await db.run(
        'UPDATE orders SET customer_id = ?, total_price = ?, payment_method = ?, items_json = ?, order_type = ?, delivery_time = ? WHERE id = ?',
        [customerId, total, paymentType || 'CASH', JSON.stringify(orderItems), orderType, deliveryTime, editingOrderId]
      );
      res.json({ success: true, message: 'Order updated in database' });
    } else {
      await db.run(
        'INSERT INTO orders (customer_id, total_price, payment_method, items_json, order_type, delivery_time) VALUES (?, ?, ?, ?, ?, ?)',
        [customerId, total, paymentType || 'CASH', JSON.stringify(orderItems), orderType, deliveryTime]
      );
      res.json({ success: true, message: 'Order saved to database' });
    }
  } catch (err) {
    console.error('Error saving order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Print Fiscal Receipt (Custom K3)
app.post('/api/print-receipt', async (req, res) => {
  try {
    const { orderItems, total, paymentType, customer, orderType, deliveryTime } = req.body;
    await printFiscalReceiptCustom({ orderItems, total, paymentType, customer, orderType, deliveryTime });
    res.json({ success: true, message: 'Receipt printed to Custom K3' });
  } catch (err) {
    console.error('Error printing receipt:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark Order as Fiscalized
app.put('/api/orders/:id/fiscalize', async (req, res) => {
  try {
    const level = req.body && req.body.level !== undefined ? req.body.level : 2; // 1 = Non Fiscale, 2 = Fiscale
    const db = getDb();
    await db.run('UPDATE orders SET is_fiscalized = ? WHERE id = ?', [level, req.params.id]);
    res.json({ success: true, message: 'Order marked as fiscalized level ' + level });
  } catch(err) {
    console.error('Error fiscalizing order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Order deleted' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// End of Day Fiscal Closure (Custom K3)
app.post('/api/close-day', async (req, res) => {
  try {
    await closeDayCustom();
    res.json({ success: true, message: 'End of day closure executed successfully' });
  } catch (err) {
    console.error('Error closing day:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Init DB and Start Server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Pizzeria Backend proxy listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
