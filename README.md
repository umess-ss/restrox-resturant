# Restrox Restaurant Management System (MERN)

Full-stack restaurant management application built with MongoDB, Express, React, and Node.js.

## Live Demo

- **App**: http://restrox-app-env.eba-zrpzy9p6.us-east-1.elasticbeanstalk.com
- **API**: https://api.umeshrajbanshi.com.np/
- **Test credentials**:
  - Username: `admin`
  - Password: `password`

## Features

- **Authentication**: JWT-based auth with role-based access control (admin, manager, waiter, chef)
- **Menu Management**: CRUD operations for menu items with categories and availability
- **Order Management**: Create, track, and update order status through workflow
- **Table Management**: Real-time table status tracking (available, occupied, reserved, cleaning)
- **Staff Management**: User management with role assignments

## Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- Express middleware (helmet, cors, rate-limit)
- Winston logging

### Frontend
- React 18 + Vite
- React Router v6
- Zustand (state management)
- Tailwind CSS
- Axios
- React Toastify

## Project Structure

```
restaurant-management-system/
├── server/                    # Backend application
│   ├── src/
│   │   ├── config/           # Database, logger configuration
│   │   ├── middlewares/      # Auth, error handling, validation
│   │   ├── modules/          # Feature modules (auth, menu, orders, tables, staff)
│   │   │   ├── auth/
│   │   │   │   ├── auth.model.js      # User schema
│   │   │   │   ├── auth.controller.js # Auth logic
│   │   │   │   └── auth.routes.js     # Auth endpoints
│   │   │   ├── menu/         # Menu item management
│   │   │   ├── orders/       # Order management
│   │   │   ├── tables/       # Table management
│   │   │   └── staff/        # Staff management
│   │   ├── app.js            # Express app setup
│   │   └── index.js          # Server entry point
│   ├── .env.example
│   ├── public/                   # Built React/Vite frontend served by Express
│   └── package.json
│
├── client/                    # Frontend application
│   ├── src/
│   │   ├── api/              # API client and service functions
│   │   ├── components/       # Reusable components
│   │   │   └── layout/       # Layout components (Sidebar, Header)
│   │   ├── pages/            # Page components
│   │   ├── store/            # Zustand stores
│   │   ├── App.jsx           # Main app component with routing
│   │   ├── main.jsx          # React entry point
│   │   └── index.css         # Global styles + Tailwind
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── package.json              # Root package with convenience scripts
└── README.md
```

## Folder Explanations

### Backend (`server/`)

- **`config/`**: Database connection and logger setup
- **`middlewares/`**: Reusable middleware (auth protection, error handling, validation)
- **`modules/`**: Feature-based organization following modular architecture
  - Each module contains model, controller, and routes
  - Keeps related code together for maintainability
- **`app.js`**: Express app configuration (middleware, routes, error handlers)
- **`index.js`**: Server startup and database connection

### Frontend (`client/`)

- **`api/`**: Axios instance and API service functions organized by resource
- **`components/`**: Reusable UI components (layout, forms, etc.)
- **`pages/`**: Route-level page components
- **`store/`**: Zustand stores for global state (auth, etc.)
- **`App.jsx`**: Main routing and private route protection
- **`main.jsx`**: React app initialization

## Setup Instructions

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Environment Variables

**Server** (`server/.env`):
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/restaurant_db
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

**Client** (`client/.env`):
```env
VITE_API_URL=/api
```

The Vite dev server proxies `/api` and `/socket.io` to the local backend, so the frontend can use the same relative API base in development and production.

### 3. Start MongoDB

```bash
mongod
```

### 4. Run Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
npm run dev:client
```

Backend runs on `http://localhost:5000`  
Frontend runs on `http://localhost:5173`

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (protected)

### Menu
- `GET /api/menu` - Get all menu items
- `GET /api/menu/:id` - Get single item
- `POST /api/menu` - Create item (admin/manager)
- `PUT /api/menu/:id` - Update item (admin/manager)
- `DELETE /api/menu/:id` - Delete item (admin)

### Orders
- `GET /api/orders` - Get all orders (protected)
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id/status` - Update order status
- `PATCH /api/orders/:id/pay` - Mark as paid (admin/manager)

### Tables
- `GET /api/tables` - Get all tables (protected)
- `POST /api/tables` - Create table (admin/manager)
- `PUT /api/tables/:id` - Update table (admin/manager)
- `DELETE /api/tables/:id` - Delete table (admin)

### Staff
- `GET /api/staff` - Get all staff (admin/manager)
- `PUT /api/staff/:id` - Update staff (admin/manager)
- `DELETE /api/staff/:id` - Deactivate staff (admin)

## Best Practices Implemented

1. **Modular Architecture**: Feature-based folder structure for scalability
2. **Security**: Helmet, CORS, rate limiting, JWT auth, password hashing
3. **Error Handling**: Centralized error middleware with proper logging
4. **Validation**: Express-validator for input validation
5. **Clean Code**: Separation of concerns (routes → controllers → models)
6. **Environment Config**: Separate dev/prod configurations
7. **State Management**: Zustand with persistence for auth
8. **API Organization**: Dedicated API service layer
9. **Protected Routes**: Role-based access control
10. **Responsive UI**: Tailwind CSS with mobile-first approach

## Deployment

The current production deployment serves the React/Vite frontend from the Express backend on AWS Elastic Beanstalk. This keeps the frontend and API on the same origin and avoids browser mixed-content blocking.

Current stack:
- AWS Elastic Beanstalk for the Node.js/Express app
- React/Vite built into `server/public`
- MongoDB Atlas for the cloud database
- Elastic Beanstalk environment variables for production configuration

This deployment replaced the previous Amplify plus Beanstalk split deployment because Amplify served the frontend over HTTPS while the Beanstalk backend was HTTP, causing browser mixed-content blocking. CloudFront was unavailable while the AWS account required verification, and Amplify rewrites require an HTTPS target.

Required production environment variables:

```env
NODE_ENV=production
PORT=8080
MONGO_URI=your_mongodb_atlas_uri
CLIENT_URL=http://your-beanstalk-environment-url
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

Build and copy the frontend before creating the Elastic Beanstalk zip:

```bash
cd client
npm install
npm run build
cd ..
mkdir -p server/public
cp -R client/dist/. server/public/
```

Create the deployment zip from inside `server`:

```bash
cd server
zip -r ../restrox-fullstack-v1.zip . -x "node_modules/*" ".env" ".env.*" "logs/*"
```

The zip must contain `package.json` at the root and include `public/index.html` plus `public/assets`. Do not include `.env` files or `node_modules`.

More details are in [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md).

Future deployment improvements include adding HTTPS with a custom domain, ALB, and ACM; moving the frontend back to Amplify or S3/CloudFront; adding GitHub Actions CI/CD; splitting backend services if needed; and converting infrastructure to Terraform.

## Production Build

For the single-origin Beanstalk deployment, build the client and copy `client/dist` into `server/public` before starting the server. Express serves the frontend after all `/api` routes.

## Default User Roles

- **admin**: Full access
- **manager**: Menu, orders, tables, staff management
- **waiter**: Orders and tables
- **chef**: View orders and update status
