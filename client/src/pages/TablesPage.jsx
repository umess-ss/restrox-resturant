import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { fetchTables, updateTable } from '../api/tables.api.js';

const STATUS_STYLES = {
  available: { card: 'border-green-300 bg-green-50',  badge: 'bg-green-100 text-green-700',  label: 'Available' },
  occupied:  { card: 'border-red-300 bg-red-50',      badge: 'bg-red-100 text-red-700',      label: 'Occupied'  },
  reserved:  { card: 'border-yellow-300 bg-yellow-50',badge: 'bg-yellow-100 text-yellow-700',label: 'Reserved'  },
  cleaning:  { card: 'border-blue-300 bg-blue-50',    badge: 'bg-blue-100 text-blue-700',    label: 'Cleaning'  },
};

const LOCATION_ICONS = { indoor: '🏠', outdoor: '🌿', bar: '🍸' };

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await fetchTables(locationFilter ? { location: locationFilter } : {});
      setTables(data);
    } catch {
      toast.error('Failed to load tables');
    }
  }, [locationFilter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (table, status) => {
    try {
      await updateTable(table._id, { status });
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Tables</h2>
        <button
          onClick={() => navigate('/pos')}
          className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
        >🧾 Open POS</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[['Available', stats.available, 'text-green-600'], ['Occupied', stats.occupied, 'text-red-600'], ['Reserved', stats.reserved, 'text-yellow-600']].map(([label, val, color]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Location filter */}
      <div className="flex gap-2">
        {['', 'indoor', 'outdoor', 'bar'].map((loc) => (
          <button
            key={loc || 'all'}
            onClick={() => setLocationFilter(loc)}
            className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${locationFilter === loc ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >{loc ? `${LOCATION_ICONS[loc]} ${loc}` : 'All'}</button>
        ))}
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {tables.map((table) => {
          const style = STATUS_STYLES[table.status];
          return (
            <div
              key={table._id}
              className={`rounded-xl border-2 p-4 space-y-2 transition-all ${style.card}`}
            >
              {/* Table number + location */}
              <div className="flex justify-between items-start">
                <span className="text-2xl font-bold text-gray-800">{table.number}</span>
                <span className="text-lg">{LOCATION_ICONS[table.location]}</span>
              </div>

              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
                <p className="text-xs text-gray-500 mt-1">{table.capacity} seats</p>
              </div>

              {/* Active order info */}
              {table.currentOrder && (
                <div className="text-xs bg-white/70 rounded-lg p-1.5 border border-gray-200">
                  <p className="font-medium text-gray-700">{table.currentOrder.orderNumber}</p>
                  <p className="text-gray-500 capitalize">{table.currentOrder.status}</p>
                  <p className="text-orange-600 font-semibold">${table.currentOrder.totalAmount?.toFixed(2)}</p>
                </div>
              )}

              {/* Status actions */}
              <div className="flex gap-1 flex-wrap">
                {table.status !== 'available' && (
                  <button
                    onClick={() => setStatus(table, 'available')}
                    className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200"
                  >Free</button>
                )}
                {table.status !== 'reserved' && table.status !== 'occupied' && (
                  <button
                    onClick={() => setStatus(table, 'reserved')}
                    className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded hover:bg-yellow-200"
                  >Reserve</button>
                )}
                {table.status !== 'cleaning' && (
                  <button
                    onClick={() => setStatus(table, 'cleaning')}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200"
                  >Clean</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
