import express from 'express';
import cors from 'cors';
import { printOrderEpson } from './printerEpson.js';
import { printFiscalReceiptCustom, closeDayCustom } from './printerCustom.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Backend proxy is running' });
});

// Print Kitchen/Order Ticket (Epson - Non Fiscal)
app.post('/api/print-ticket', async (req, res) => {
  try {
    const { orderItems, orderId, table, notes } = req.body;
    await printOrderEpson({ orderItems, orderId, table, notes });
    res.json({ success: true, message: 'Ticket printed to Epson' });
  } catch (err) {
    console.error('Error printing ticket:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Print Fiscal Receipt (Custom K3)
app.post('/api/print-receipt', async (req, res) => {
  try {
    const { orderItems, total, paymentType } = req.body;
    await printFiscalReceiptCustom({ orderItems, total, paymentType });
    res.json({ success: true, message: 'Fiscal receipt printed to Custom K3' });
  } catch (err) {
    console.error('Error printing receipt:', err);
    res.status(500).json({ success: false, error: err.message });
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

app.listen(PORT, () => {
  console.log(`Pizzeria Backend proxy listening on http://localhost:${PORT}`);
});
