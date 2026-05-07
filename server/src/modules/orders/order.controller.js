import Order from './order.model.js';

export const getOrders = async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const orders = await Order.find(filter)
    .populate('table', 'number capacity')
    .populate('waiter', 'name')
    .populate('items.menuItem', 'name')
    .sort('-createdAt');
  res.json(orders);
};

export const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('table')
    .populate('waiter', 'name email')
    .populate('items.menuItem');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
};

export const createOrder = async (req, res) => {
  const { table, items, notes } = req.body;
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const order = await Order.create({ table, waiter: req.user._id, items, totalAmount, notes });
  res.status(201).json(order);
};

export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
};

export const markOrderPaid = async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { paymentStatus: 'paid' },
    { new: true }
  );
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
};
