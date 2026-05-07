import useAuthStore from '../../store/authStore.js';

export default function Header() {
  const { user, logout } = useAuthStore();
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <span className="text-gray-500 text-sm">Restaurant Management System</span>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">{user?.name}</span>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
          {user?.role}
        </span>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
