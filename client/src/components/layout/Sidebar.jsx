import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '♕' },
  { to: '/orders', label: 'Food Order', icon: '♨' },
  { to: '/feedback', label: 'Feedback', icon: '★' },
  { to: '/notifications', label: 'Message', icon: '▣' },
  { to: '/pos', label: 'POS', icon: '▤' },
  { to: '/kds', label: 'Kitchen', icon: '◴' },
  { to: '/tables', label: 'Tables', icon: '◫' },
  { to: '/menu', label: 'Menu', icon: '♨' },
  { to: '/inventory', label: 'Inventory', icon: '▦' },
];

const staffLinks = [
  { to: '/staff?tab=dashboard', tab: 'dashboard', label: 'Dashboard' },
  { to: '/staff?tab=roster', tab: 'roster', label: 'Employees' },
  { to: '/staff?tab=shifts', tab: 'shifts', label: 'Attendance' },
  { to: '/staff?tab=payroll', tab: 'payroll', label: 'Payroll' },
];

export default function Sidebar() {
  const location = useLocation();
  const isStaff = location.pathname === '/staff';
  const activeStaffTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
  const [staffOpen, setStaffOpen] = useState(isStaff);

  useEffect(() => {
    if (isStaff) setStaffOpen(true);
  }, [isStaff]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-white text-gray-900 shadow-sm lg:flex">
      <div className="px-8 pb-10 pt-12 text-center">
        <span className="text-3xl font-extrabold tracking-tight text-gray-900">
          RestroX<span className="text-orange-500">.</span>
        </span>
      </div>
      <nav className="flex-1 space-y-3 px-8">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              `flex min-h-14 items-center gap-5 rounded-2xl px-5 py-4 text-sm font-bold transition-all ${
                isActive
                  ? 'bg-orange-500 text-white shadow-xl shadow-orange-100'
                  : 'text-[#9b94ad] hover:bg-orange-50 hover:text-orange-500'
              }`
            }
          >
            <span className="grid h-6 w-6 place-items-center text-lg leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}

        <div className="space-y-2">
          <div
            className={`flex min-h-14 items-center overflow-hidden rounded-2xl text-sm font-bold transition-all ${
              isStaff
                ? 'bg-orange-500 text-white shadow-xl shadow-orange-100'
                : 'text-[#9b94ad] hover:bg-orange-50 hover:text-orange-500'
            }`}
          >
            <NavLink
              to="/staff?tab=dashboard"
              className="flex min-h-14 flex-1 items-center gap-5 px-5 py-4"
            >
              <span className="grid h-6 w-6 place-items-center text-lg leading-none">♟</span>
              Staff
            </NavLink>
            <button
              type="button"
              onClick={() => setStaffOpen((open) => !open)}
              aria-label={staffOpen ? 'Hide staff menu' : 'Show staff menu'}
              aria-expanded={staffOpen}
              className={`mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs transition ${
                isStaff ? 'text-white hover:bg-white/15' : 'text-[#9b94ad] hover:bg-orange-100 hover:text-orange-500'
              }`}
            >
              {staffOpen ? '⌃' : '⌄'}
            </button>
          </div>

          {staffOpen && (
            <div className="ml-7 space-y-1 border-l border-orange-100 py-1 pl-4">
              {staffLinks.map((item) => (
                <Link
                  key={item.tab}
                  to={item.to}
                  className={`block rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isStaff && activeStaffTab === item.tab
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-[#9b94ad] hover:bg-orange-50 hover:text-orange-500'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="px-8 pb-9 pt-6">
        <div className="overflow-hidden rounded-3xl bg-orange-400 p-5 text-white shadow-xl shadow-orange-100">
          <p className="text-base font-extrabold leading-snug">Upgrade your Account to Get Free Voucher</p>
          <button className="mt-4 rounded-lg bg-white px-5 py-2 text-sm font-extrabold text-gray-900">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}
