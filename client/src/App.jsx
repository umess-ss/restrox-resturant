import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore.js';
import Layout from './components/layout/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import TablesPage from './pages/TablesPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import POSPage from './pages/POSPage.jsx';
import KDSPage from './pages/KDSPage.jsx';
import OnboardPage from './pages/OnboardPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import CustomerTablePage from './pages/customer/CustomerTablePage.jsx';
import CustomerOrderStatusPage from './pages/customer/CustomerOrderStatusPage.jsx';

const PrivateRoute = ({ children }) => {
  const token = useAuthStore((s) => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* ─── Public customer QR routes — no auth, no layout ─── */}
      <Route
        path="/customer/:restaurantId/:branchId/table/:tableId"
        element={<CustomerTablePage />}
      />
      <Route
        path="/customer/order/:orderId/status"
        element={<CustomerOrderStatusPage />}
      />

      {/* ─── Staff / admin routes ─── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboard" element={<OnboardPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="kds" element={<KDSPage />} />
      </Route>
    </Routes>
  );
}
