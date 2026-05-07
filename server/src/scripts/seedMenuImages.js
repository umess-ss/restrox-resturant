import 'dotenv/config';
import mongoose from 'mongoose';
import MenuItem from '../modules/menu/menu.model.js';
import logger from '../config/logger.js';

const MENU_IMAGES = {
  'Bruschetta': 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=800&q=80',
  'Caesar Salad': 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=800&q=80',
  'Chicken Wings': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80',
  'Garlic Bread': 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=800&q=80',
  'Cappuccino': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
  'Coca Cola': 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=800&q=80',
  'Espresso': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80',
  'Fresh Orange Juice': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=800&q=80',
  'Latte': 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=800&q=80',
  'Cheesecake': 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=800&q=80',
  'Chocolate Lava Cake': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  'Tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80',
  'Burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
  'Classic Burger': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  'Grilled Chicken': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
  'Grilled Salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
  'Margherita Pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
  'Pasta Arrabbiata': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80',
  'Pasta Carbonara': 'https://images.unsplash.com/photo-1608756687911-aa1599ab3bd9?auto=format&fit=crop&w=800&q=80',
  "Chef's Special Steak": 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
  'Seafood Platter': 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=800&q=80',
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info('Connected to MongoDB');

  let matched = 0;
  let updated = 0;

  for (const [name, imageUrl] of Object.entries(MENU_IMAGES)) {
    const result = await MenuItem.updateMany(
      { name },
      { $set: { imageUrl } }
    );

    matched += result.matchedCount;
    updated += result.modifiedCount;
    logger.info(`Menu image seeded: ${name} (${result.matchedCount} matched)`);
  }

  logger.info(`Menu image seed complete: ${matched} matched, ${updated} updated`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  logger.error(`Menu image seed failed: ${err.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
