import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/pos', label: 'POS', icon: '🧾' },
  { to: '/kds', label: 'Kitchen', icon: '👨‍🍳' },
  { to: '/orders', label: 'Orders', icon: '📋' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/tables', label: 'Tables', icon: '🪑' },
  { to: '/menu', label: 'Menu', icon: '🍽️' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/staff', label: 'Staff', icon: '👥' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="p-5 text-xl font-bold text-orange-400 border-b border-gray-700">
        🍴 RMS
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
