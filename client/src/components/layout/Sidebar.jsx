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
  const isStaff = location.pathname.startsWith('/staff');
  const activeStaffTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
  const [staffOpen, setStaffOpen] = useState(isStaff);

  useEffect(() => {
    setStaffOpen(isStaff);
  }, [isStaff]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-white text-gray-900 shadow-sm lg:flex">
      <div className="px-8 pb-10 pt-12 text-center">
        <span className="text-3xl font-extrabold tracking-tight text-gray-900">
          RestroX<span className="text-orange-500">.</span>
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-8 pb-4 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300">
        <div className="mb-6 overflow-hidden rounded-xl border border-orange-200 bg-white shrink-0">
          <div className="flex items-center gap-3 bg-orange-50/50 p-3">
            <div className="rounded-lg bg-white p-2 text-orange-500 shadow-sm border border-orange-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">New Cafee</h3>
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <span className="text-orange-500">👑</span> Premium (Trial)
              </p>
            </div>
            <svg className="ml-auto text-gray-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <button className="w-full border-t border-orange-100 bg-orange-50 py-2.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100">
            Upgrade Now ⚡
          </button>
        </div>

        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              `flex min-h-14 items-center gap-5 rounded-2xl px-5 py-4 text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-orange-500 text-white shadow-xl shadow-orange-100 scale-[1.02]'
                  : 'text-[#9b94ad] hover:bg-orange-50 hover:text-orange-500 hover:scale-[1.02]'
              }`
            }
          >
            <span className="grid h-6 w-6 place-items-center text-lg leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}

        <div className="space-y-2">
          <div
            className={`flex min-h-14 items-center overflow-hidden rounded-2xl text-sm font-bold transition-all duration-200 ${
              isStaff
                ? 'bg-orange-500 text-white shadow-xl shadow-orange-100 scale-[1.02]'
                : 'text-[#9b94ad] hover:bg-orange-50 hover:text-orange-500 hover:scale-[1.02]'
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
              aria-controls="staff-submenu"
              className={`mr-3 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs transition ${
                isStaff ? 'text-white hover:bg-white/15' : 'text-[#9b94ad] hover:bg-orange-100 hover:text-orange-500'
              }`}
            >
              <span
                className={`inline-block text-sm leading-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  staffOpen ? 'rotate-180' : 'rotate-0'
                }`}
              >
                ⌄
              </span>
            </button>
          </div>

          <div
            id="staff-submenu"
            className={`grid transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              staffOpen
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden">
              <div className="ml-[2.25rem] space-y-0 py-2 relative">
                {staffLinks.map((item, index) => {
                  const isActiveTab = isStaff && activeStaffTab === item.tab;
                  return (
                    <Link
                      key={item.tab}
                      to={item.to}
                      className={`relative block pl-6 py-2.5 text-[13px] transition-colors duration-200 ease-out ${
                        isActiveTab
                          ? 'text-gray-900 font-semibold'
                          : 'text-[#9b94ad] hover:text-gray-900'
                      }`}
                    >
                      {/* Dot */}
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full z-10 transition-colors ${
                        isActiveTab ? 'bg-gray-600' : 'bg-gray-400'
                      }`} />
                      {/* Vertical connecting line */}
                      {index !== staffLinks.length - 1 && (
                        <span className="absolute left-0 top-1/2 flex w-[6px] justify-center h-full">
                          <span className="w-[1px] h-full bg-gray-200" />
                        </span>
                      )}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
