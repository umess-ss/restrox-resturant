import Feedback from './feedback.model.js';
import Order from '../orders/order.model.js';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const getFeedback = async (req, res) => {
  const { rating, sentiment, page = 1, limit = 12 } = req.query;
  const filter = { ...req.branchFilter };
  if (sentiment) filter.sentiment = sentiment;
  if (rating) filter.rating = Number(rating);

  const safeLimit = Math.min(Number(limit) || 12, 50);
  const skip = (Math.max(Number(page), 1) - 1) * safeLimit;

  const [items, total, summary, monthly] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('order', 'orderNumber totalAmount createdAt')
      .populate('table', 'number')
      .lean(),
    Feedback.countDocuments(filter),
    Feedback.aggregate([
      { $match: { ...req.branchFilter } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          positive: { $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } },
          bad: { $sum: { $cond: [{ $eq: ['$sentiment', 'bad'] }, 1, 0] } },
          avgRating: { $avg: '$rating' },
        },
      },
    ]),
    Feedback.aggregate([
      { $match: { ...req.branchFilter } },
      {
        $group: {
          _id: { month: { $month: '$createdAt' }, sentiment: '$sentiment' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const chart = monthLabels.map((month, idx) => {
    const monthNumber = idx + 1;
    const positive = monthly.find((m) => m._id.month === monthNumber && m._id.sentiment === 'positive')?.count || 0;
    const bad = monthly.find((m) => m._id.month === monthNumber && m._id.sentiment === 'bad')?.count || 0;
    return { month, positive, bad };
  });

  res.json({
    items,
    total,
    page: Number(page),
    pages: Math.ceil(total / safeLimit) || 1,
    summary: summary[0] || { total: 0, positive: 0, bad: 0, avgRating: 0 },
    chart,
  });
};

export const createFeedback = async (req, res) => {
  const feedback = await Feedback.create({
    ...req.body,
    restaurant: req.restaurantId,
    branch: req.branchId,
    source: 'staff',
  });
  res.status(201).json(feedback);
};

export const submitPublicFeedback = async (req, res) => {
  const order = await Order.findById(req.params.orderId).select(
    'restaurant branch table customerName customerPhone'
  );
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const feedback = await Feedback.findOneAndUpdate(
    { order: order._id },
    {
      order: order._id,
      restaurant: order.restaurant,
      branch: order.branch,
      table: order.table,
      customerName: req.body.customerName || order.customerName,
      customerPhone: req.body.customerPhone || order.customerPhone,
      rating: req.body.rating,
      comment: req.body.comment,
      source: 'customer_qr',
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ success: true, feedback });
};
