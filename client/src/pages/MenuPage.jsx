import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchMenuItems, deleteMenuItem } from '../api/menu.api.js';

export default function MenuPage() {
  const [items, setItems] = useState([]);

  const load = () => fetchMenuItems().then(setItems).catch(() => toast.error('Failed to load menu'));

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteMenuItem(id);
      toast.success('Item deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Menu Items</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item._id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500 capitalize">{item.category}</p>
                <p className="text-orange-500 font-bold mt-1">${item.price.toFixed(2)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${item.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <button
              onClick={() => handleDelete(item._id)}
              className="mt-3 text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
