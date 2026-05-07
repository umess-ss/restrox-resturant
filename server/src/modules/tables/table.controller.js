import Table from './table.model.js';
import Order from '../orders/order.model.js';
import QRCode from 'qrcode';

export const getTables = async (req, res) => {
  const { status, location } = req.query;
  const filter = { ...req.branchFilter };
  if (status) filter.status = status;
  if (location) filter.location = location;

  const tables = await Table.find(filter)
    .populate('currentOrder', 'orderNumber status totalAmount createdAt')
    .sort('number');
  res.json(tables);
};

export const getTable = async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, ...req.tenantFilter }).populate('currentOrder');
  if (!table) return res.status(404).json({ message: 'Table not found' });
  res.json(table);
};

export const createTable = async (req, res) => {
  const table = await Table.create({ ...req.body, restaurant: req.restaurantId, branch: req.branchId });
  res.status(201).json(table);
};

export const updateTable = async (req, res) => {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!table) return res.status(404).json({ message: 'Table not found' });
  res.json(table);
};

export const deleteTable = async (req, res) => {
  const table = await Table.findByIdAndDelete(req.params.id);
  if (!table) return res.status(404).json({ message: 'Table not found' });
  res.status(204).send();
};

/**
 * GET /api/tables/:id/order
 * Returns the active order for a table (if any).
 */
export const getTableOrder = async (req, res) => {
  const table = await Table.findById(req.params.id);
  if (!table) return res.status(404).json({ message: 'Table not found' });
  if (!table.currentOrder) return res.json(null);

  const order = await Order.findById(table.currentOrder)
    .populate('items.menuItem', 'name category price')
    .populate('waiter', 'name');
  res.json(order);
};

/**
 * GET /api/tables/:id/qr
 * Generates a QR code for the customer ordering URL of this table.
 * Requires admin or manager role.
 */
export const getTableQR = async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, ...req.tenantFilter });
  if (!table) return res.status(404).json({ message: 'Table not found' });

  if (!table.restaurant || !table.branch) {
    return res.status(422).json({ message: 'Table is missing restaurant or branch data' });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const qrUrl = `${clientUrl}/customer/${table.restaurant}/${table.branch}/table/${table._id}`;

  // Generate QR as base64 data URL (PNG)
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  res.json({
    success: true,
    tableId: table._id,
    tableNumber: table.number,
    restaurantId: table.restaurant,
    branchId: table.branch,
    qrUrl,
    qrDataUrl,
  });
};
