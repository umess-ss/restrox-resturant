import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchTables, updateTable } from '../api/tables.api.js';

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-700 border-green-200',
  occupied: 'bg-red-100 text-red-700 border-red-200',
  reserved: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cleaning: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function TablesPage() {
  const [tables, setTables] = useState([]);

  const load = () => fetchTables().then(setTables).catch(() => toast.error('Failed to load tables'));

  useEffect(() => { load(); }, []);

  const cycleStatus = async (table) => {
    const cycle = ['available', 'occupied', 'reserved', 'cleaning'];
    const next = cycle[(cycle.indexOf(table.status) + 1) % cycle.length];
    try {
      await updateTable(table._id, { status: next });
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Tables</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((table) => (
          <button
            key={table._id}
            onClick={() => cycleStatus(table)}
            className={`rounded-xl border-2 p-4 text-center transition-all hover:scale-105 ${STATUS_COLORS[table.status]}`}
          >
            <p className="text-2xl font-bold">{table.number}</p>
            <p className="text-xs mt-1 capitalize">{table.status}</p>
            <p className="text-xs opacity-70">{table.capacity} seats</p>
          </button>
        ))}
      </div>
    </div>
  );
}
