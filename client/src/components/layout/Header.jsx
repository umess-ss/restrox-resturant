import useAuthStore from '../../store/authStore.js';
import useTenantStore from '../../store/tenantStore.js';

export default function Header() {
  const { user, logout } = useAuthStore();
  const restaurant = useTenantStore((s) => s.restaurant);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-gray-700 font-semibold text-sm">{restaurant?.name || 'Restaurant'}</span>
        {restaurant?.plan && (
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
            restaurant.plan === 'trial' ? 'bg-yellow-100 text-yellow-700' :
            restaurant.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>
            {restaurant.plan}
          </span>
        )}
      </div>
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
