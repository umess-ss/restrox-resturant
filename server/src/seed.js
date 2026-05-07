/**
 * Full seed script — populates the database with realistic demo data.
 * Safe to re-run: skips existing records.
 * Run: node src/seed.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from './modules/auth/auth.model.js';
import MenuItem from './modules/menu/menu.model.js';
import Table from './modules/tables/table.model.js';
import Ingredient from './modules/inventory/ingredient.model.js';
import Recipe from './modules/inventory/recipe.model.js';
import StaffProfile from './modules/staff/staffProfile.model.js';
import logger from './config/logger.js';

await mongoose.connect(process.env.MONGO_URI);
logger.info('Connected to MongoDB');

// ─── 1. Users ─────────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Admin User',    email: 'admin@rms.com',    password: 'admin123',    role: 'admin'   },
  { name: 'Sarah Manager', email: 'manager@rms.com',  password: 'manager123',  role: 'manager' },
  { name: 'Marco Chef',    email: 'chef@rms.com',     password: 'chef123',     role: 'chef'    },
  { name: 'Alex Waiter',   email: 'waiter@rms.com',   password: 'waiter123',   role: 'waiter'  },
  { name: 'Lisa Waiter',   email: 'waiter2@rms.com',  password: 'waiter123',   role: 'waiter'  },
];

const userMap = {};
for (const u of USERS) {
  let user = await User.findOne({ email: u.email });
  if (!user) {
    user = await User.create(u);
    logger.info(`Created user: ${u.email}`);
  } else {
    logger.info(`Exists: ${u.email}`);
  }
  userMap[u.role] = userMap[u.role] || user;
  userMap[u.email] = user;
}

// ─── 2. Staff Profiles ────────────────────────────────────────────────────────

const PROFILES = [
  { email: 'manager@rms.com', department: 'management', salaryType: 'monthly', baseSalary: 4500, defaultShiftStart: '09:00', defaultShiftEnd: '18:00' },
  { email: 'chef@rms.com',    department: 'kitchen',    salaryType: 'monthly', baseSalary: 3800, defaultShiftStart: '08:00', defaultShiftEnd: '17:00' },
  { email: 'waiter@rms.com',  department: 'floor',      salaryType: 'hourly',  baseSalary: 15,   defaultShiftStart: '10:00', defaultShiftEnd: '18:00' },
  { email: 'waiter2@rms.com', department: 'floor',      salaryType: 'hourly',  baseSalary: 15,   defaultShiftStart: '14:00', defaultShiftEnd: '22:00' },
];

for (const p of PROFILES) {
  const user = userMap[p.email];
  const exists = await StaffProfile.findOne({ user: user._id });
  if (!exists) {
    await StaffProfile.create({ user: user._id, ...p });
    logger.info(`Created profile: ${p.email}`);
  }
}

// ─── 3. Tables ────────────────────────────────────────────────────────────────

const TABLES = [
  { number: 1,  capacity: 2, location: 'indoor'  },
  { number: 2,  capacity: 4, location: 'indoor'  },
  { number: 3,  capacity: 4, location: 'indoor'  },
  { number: 4,  capacity: 6, location: 'indoor'  },
  { number: 5,  capacity: 6, location: 'indoor'  },
  { number: 6,  capacity: 8, location: 'indoor'  },
  { number: 7,  capacity: 2, location: 'outdoor' },
  { number: 8,  capacity: 4, location: 'outdoor' },
  { number: 9,  capacity: 4, location: 'outdoor' },
  { number: 10, capacity: 2, location: 'bar'     },
  { number: 11, capacity: 2, location: 'bar'     },
];

for (const t of TABLES) {
  const exists = await Table.findOne({ number: t.number });
  if (!exists) {
    await Table.create(t);
    logger.info(`Created table: ${t.number}`);
  }
}

// ─── 4. Ingredients ───────────────────────────────────────────────────────────

const INGREDIENTS = [
  { name: 'Chicken Breast',   unit: 'kg',  quantity: 15,  threshold: 3,  costPerUnit: 8.50,  supplier: { name: 'FreshMeat Co',    contact: '555-0101' } },
  { name: 'Beef Patty',       unit: 'kg',  quantity: 12,  threshold: 3,  costPerUnit: 12.00, supplier: { name: 'FreshMeat Co',    contact: '555-0101' } },
  { name: 'Salmon Fillet',    unit: 'kg',  quantity: 6,   threshold: 2,  costPerUnit: 22.00, supplier: { name: 'Ocean Fresh',     contact: '555-0202' } },
  { name: 'Pasta',            unit: 'kg',  quantity: 20,  threshold: 5,  costPerUnit: 2.50,  supplier: { name: 'Dry Goods Plus',  contact: '555-0303' } },
  { name: 'Tomato Sauce',     unit: 'l',   quantity: 10,  threshold: 3,  costPerUnit: 3.00,  supplier: { name: 'Dry Goods Plus',  contact: '555-0303' } },
  { name: 'Mozzarella',       unit: 'kg',  quantity: 8,   threshold: 2,  costPerUnit: 9.00,  supplier: { name: 'Dairy Direct',    contact: '555-0404' } },
  { name: 'Burger Bun',       unit: 'pcs', quantity: 80,  threshold: 20, costPerUnit: 0.50,  supplier: { name: 'City Bakery',     contact: '555-0505' } },
  { name: 'Lettuce',          unit: 'kg',  quantity: 5,   threshold: 1,  costPerUnit: 2.00,  supplier: { name: 'Green Farms',     contact: '555-0606' } },
  { name: 'Tomato',           unit: 'kg',  quantity: 8,   threshold: 2,  costPerUnit: 2.50,  supplier: { name: 'Green Farms',     contact: '555-0606' } },
  { name: 'French Fries',     unit: 'kg',  quantity: 18,  threshold: 5,  costPerUnit: 3.00,  supplier: { name: 'Frozen Foods Ltd',contact: '555-0707' } },
  { name: 'Olive Oil',        unit: 'l',   quantity: 5,   threshold: 1,  costPerUnit: 8.00,  supplier: { name: 'Dry Goods Plus',  contact: '555-0303' } },
  { name: 'Garlic',           unit: 'kg',  quantity: 3,   threshold: 0.5,costPerUnit: 4.00,  supplier: { name: 'Green Farms',     contact: '555-0606' } },
  { name: 'Cream',            unit: 'l',   quantity: 6,   threshold: 2,  costPerUnit: 4.50,  supplier: { name: 'Dairy Direct',    contact: '555-0404' } },
  { name: 'Chocolate',        unit: 'kg',  quantity: 4,   threshold: 1,  costPerUnit: 15.00, supplier: { name: 'Sweet Supply',    contact: '555-0808' } },
  { name: 'Flour',            unit: 'kg',  quantity: 25,  threshold: 5,  costPerUnit: 1.20,  supplier: { name: 'Dry Goods Plus',  contact: '555-0303' } },
  { name: 'Eggs',             unit: 'pcs', quantity: 120, threshold: 24, costPerUnit: 0.30,  supplier: { name: 'Dairy Direct',    contact: '555-0404' } },
  { name: 'Coca Cola',        unit: 'pcs', quantity: 60,  threshold: 12, costPerUnit: 0.80,  supplier: { name: 'Beverage World',  contact: '555-0909' } },
  { name: 'Orange Juice',     unit: 'l',   quantity: 10,  threshold: 3,  costPerUnit: 3.50,  supplier: { name: 'Beverage World',  contact: '555-0909' } },
  { name: 'Coffee Beans',     unit: 'kg',  quantity: 3,   threshold: 1,  costPerUnit: 25.00, supplier: { name: 'Roast Masters',   contact: '555-1010' } },
  { name: 'Milk',             unit: 'l',   quantity: 12,  threshold: 3,  costPerUnit: 1.50,  supplier: { name: 'Dairy Direct',    contact: '555-0404' } },
];

const ingredientMap = {};
for (const ing of INGREDIENTS) {
  let item = await Ingredient.findOne({ name: ing.name });
  if (!item) {
    item = await Ingredient.create(ing);
    logger.info(`Created ingredient: ${ing.name}`);
  }
  ingredientMap[ing.name] = item;
}

// ─── 5. Menu Items ────────────────────────────────────────────────────────────

const MENU_ITEMS = [
  // Appetizers
  { name: 'Garlic Bread',         category: 'appetizer', price: 6.50,  description: 'Toasted bread with garlic butter and herbs',         preparationTime: 8,  tags: ['vegetarian'], overheadCost: 0.50 },
  { name: 'Caesar Salad',         category: 'appetizer', price: 9.00,  description: 'Romaine lettuce, croutons, parmesan, caesar dressing', preparationTime: 10, tags: ['vegetarian'], overheadCost: 0.80 },
  { name: 'Chicken Wings',        category: 'appetizer', price: 12.00, description: 'Crispy wings with choice of sauce',                   preparationTime: 15, tags: ['spicy'],      overheadCost: 1.00 },
  { name: 'Bruschetta',           category: 'appetizer', price: 8.00,  description: 'Toasted bread with tomato, basil and olive oil',      preparationTime: 8,  tags: ['vegetarian'], overheadCost: 0.60 },

  // Mains
  { name: 'Classic Burger',       category: 'main',      price: 14.00, description: 'Beef patty, lettuce, tomato, cheese in a brioche bun', preparationTime: 15, tags: [],             overheadCost: 1.20 },
  { name: 'Grilled Chicken',      category: 'main',      price: 16.00, description: 'Marinated chicken breast with seasonal vegetables',    preparationTime: 20, tags: ['gluten-free'], overheadCost: 1.50 },
  { name: 'Pasta Arrabbiata',     category: 'main',      price: 13.00, description: 'Penne pasta in spicy tomato sauce',                   preparationTime: 18, tags: ['vegetarian', 'spicy'], overheadCost: 1.00 },
  { name: 'Grilled Salmon',       category: 'main',      price: 22.00, description: 'Atlantic salmon with lemon butter and asparagus',      preparationTime: 20, tags: ['gluten-free'], overheadCost: 2.00 },
  { name: 'Margherita Pizza',     category: 'main',      price: 15.00, description: 'Classic tomato, mozzarella and fresh basil',           preparationTime: 20, tags: ['vegetarian'], overheadCost: 1.50 },
  { name: 'Pasta Carbonara',      category: 'main',      price: 14.00, description: 'Spaghetti with creamy egg sauce and pancetta',         preparationTime: 18, tags: [],             overheadCost: 1.20 },

  // Desserts
  { name: 'Chocolate Lava Cake',  category: 'dessert',   price: 8.50,  description: 'Warm chocolate cake with molten center',              preparationTime: 12, tags: ['vegetarian'], overheadCost: 0.80 },
  { name: 'Tiramisu',             category: 'dessert',   price: 7.50,  description: 'Classic Italian dessert with mascarpone and coffee',   preparationTime: 5,  tags: ['vegetarian'], overheadCost: 0.60 },
  { name: 'Cheesecake',           category: 'dessert',   price: 7.00,  description: 'New York style cheesecake with berry compote',         preparationTime: 5,  tags: ['vegetarian'], overheadCost: 0.60 },

  // Beverages
  { name: 'Coca Cola',            category: 'beverage',  price: 3.00,  description: 'Chilled Coca Cola 330ml',                             preparationTime: 2,  tags: [],             overheadCost: 0.20 },
  { name: 'Fresh Orange Juice',   category: 'beverage',  price: 4.50,  description: 'Freshly squeezed orange juice',                       preparationTime: 5,  tags: ['vegan'],      overheadCost: 0.30 },
  { name: 'Espresso',             category: 'beverage',  price: 3.50,  description: 'Double shot espresso',                                preparationTime: 3,  tags: ['vegan'],      overheadCost: 0.30 },
  { name: 'Cappuccino',           category: 'beverage',  price: 4.50,  description: 'Espresso with steamed milk foam',                     preparationTime: 4,  tags: [],             overheadCost: 0.40 },
  { name: 'Latte',                category: 'beverage',  price: 4.50,  description: 'Espresso with steamed milk',                          preparationTime: 4,  tags: [],             overheadCost: 0.40 },

  // Specials
  { name: "Chef's Special Steak", category: 'special',   price: 32.00, description: 'Prime cut ribeye with truffle butter and fries',       preparationTime: 25, tags: ['gluten-free'], overheadCost: 3.00 },
  { name: 'Seafood Platter',      category: 'special',   price: 45.00, description: 'Mixed seafood with dipping sauces',                   preparationTime: 30, tags: ['gluten-free'], overheadCost: 4.00 },
];

const menuMap = {};
for (const item of MENU_ITEMS) {
  let mi = await MenuItem.findOne({ name: item.name });
  if (!mi) {
    mi = await MenuItem.create(item);
    logger.info(`Created menu item: ${item.name}`);
  }
  menuMap[item.name] = mi;
}

// ─── 6. Recipes ───────────────────────────────────────────────────────────────

const I = (name) => ingredientMap[name]?._id;
const M = (name) => menuMap[name]?._id;

const RECIPES = [
  {
    menuItem: 'Classic Burger',
    ingredients: [
      { ingredient: I('Beef Patty'),   quantity: 0.2  },
      { ingredient: I('Burger Bun'),   quantity: 1    },
      { ingredient: I('Lettuce'),      quantity: 0.05 },
      { ingredient: I('Tomato'),       quantity: 0.05 },
      { ingredient: I('French Fries'), quantity: 0.15 },
    ],
  },
  {
    menuItem: 'Grilled Chicken',
    ingredients: [
      { ingredient: I('Chicken Breast'), quantity: 0.25 },
      { ingredient: I('Olive Oil'),      quantity: 0.02 },
      { ingredient: I('Garlic'),         quantity: 0.01 },
    ],
  },
  {
    menuItem: 'Pasta Arrabbiata',
    ingredients: [
      { ingredient: I('Pasta'),        quantity: 0.15 },
      { ingredient: I('Tomato Sauce'), quantity: 0.15 },
      { ingredient: I('Olive Oil'),    quantity: 0.02 },
      { ingredient: I('Garlic'),       quantity: 0.01 },
    ],
  },
  {
    menuItem: 'Grilled Salmon',
    ingredients: [
      { ingredient: I('Salmon Fillet'), quantity: 0.22 },
      { ingredient: I('Olive Oil'),     quantity: 0.02 },
      { ingredient: I('Cream'),         quantity: 0.05 },
    ],
  },
  {
    menuItem: 'Margherita Pizza',
    ingredients: [
      { ingredient: I('Flour'),        quantity: 0.2  },
      { ingredient: I('Tomato Sauce'), quantity: 0.1  },
      { ingredient: I('Mozzarella'),   quantity: 0.15 },
      { ingredient: I('Olive Oil'),    quantity: 0.02 },
    ],
  },
  {
    menuItem: 'Pasta Carbonara',
    ingredients: [
      { ingredient: I('Pasta'),  quantity: 0.15 },
      { ingredient: I('Eggs'),   quantity: 2    },
      { ingredient: I('Cream'),  quantity: 0.08 },
    ],
  },
  {
    menuItem: 'Chocolate Lava Cake',
    ingredients: [
      { ingredient: I('Chocolate'), quantity: 0.08 },
      { ingredient: I('Flour'),     quantity: 0.05 },
      { ingredient: I('Eggs'),      quantity: 2    },
      { ingredient: I('Cream'),     quantity: 0.05 },
    ],
  },
  {
    menuItem: 'Coca Cola',
    ingredients: [
      { ingredient: I('Coca Cola'), quantity: 1 },
    ],
  },
  {
    menuItem: 'Fresh Orange Juice',
    ingredients: [
      { ingredient: I('Orange Juice'), quantity: 0.3 },
    ],
  },
  {
    menuItem: 'Espresso',
    ingredients: [
      { ingredient: I('Coffee Beans'), quantity: 0.018 },
    ],
  },
  {
    menuItem: 'Cappuccino',
    ingredients: [
      { ingredient: I('Coffee Beans'), quantity: 0.018 },
      { ingredient: I('Milk'),         quantity: 0.15  },
    ],
  },
  {
    menuItem: 'Latte',
    ingredients: [
      { ingredient: I('Coffee Beans'), quantity: 0.018 },
      { ingredient: I('Milk'),         quantity: 0.25  },
    ],
  },
  {
    menuItem: 'Chicken Wings',
    ingredients: [
      { ingredient: I('Chicken Breast'), quantity: 0.3  },
      { ingredient: I('Olive Oil'),      quantity: 0.02 },
    ],
  },
  {
    menuItem: 'Garlic Bread',
    ingredients: [
      { ingredient: I('Flour'),     quantity: 0.1  },
      { ingredient: I('Garlic'),    quantity: 0.02 },
      { ingredient: I('Olive Oil'), quantity: 0.02 },
    ],
  },
];

for (const r of RECIPES) {
  const menuItemId = M(r.menuItem);
  if (!menuItemId) { logger.warn(`No menu item for recipe: ${r.menuItem}`); continue; }
  const exists = await Recipe.findOne({ menuItem: menuItemId });
  if (!exists) {
    await Recipe.create({ menuItem: menuItemId, ingredients: r.ingredients, isActive: true });
    logger.info(`Created recipe: ${r.menuItem}`);
  }
}

await mongoose.disconnect();
logger.info('\n✅ Seed complete! Login credentials:');
logger.info('  admin@rms.com    / admin123');
logger.info('  manager@rms.com  / manager123');
logger.info('  chef@rms.com     / chef123');
logger.info('  waiter@rms.com   / waiter123');
logger.info('  waiter2@rms.com  / waiter123');
