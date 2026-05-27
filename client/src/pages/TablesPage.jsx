import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { fetchTables, createTable, updateTable, deleteTable, fetchTableQR } from '../api/tables.api.js';
import formatCurrency from '../utils/formatCurrency.js';

const STATUS_STYLES = {
  available: { card: 'border-green-300 bg-green-50',  badge: 'bg-green-100 text-green-700',  label: 'Available' },
  occupied:  { card: 'border-red-300 bg-red-50',      badge: 'bg-red-100 text-red-700',      label: 'Occupied'  },
  reserved:  { card: 'border-yellow-300 bg-yellow-50',badge: 'bg-yellow-100 text-yellow-700',label: 'Reserved'  },
  cleaning:  { card: 'border-blue-300 bg-blue-50',    badge: 'bg-blue-100 text-blue-700',    label: 'Cleaning'  },
};

const LOCATION_ICONS = { indoor: '🏠', outdoor: '🌿', bar: '🍸' };
const tableDisplayId = (table) => table.tableId || `TABLE-${String(table.number || 0).padStart(4, '0')}`;

// ─── QR Modal ─────────────────────────────────────────────────────────────────

function QRModal({ qrData, onClose }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(qrData.qrUrl)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Copy failed'));
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrData.qrDataUrl;
    a.download = `table-${qrData.tableNumber}-qr.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">Table {qrData.tableNumber} QR Code</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
        </div>

        {/* QR image */}
        <div className="flex flex-col items-center gap-2">
          <img
            src={qrData.qrDataUrl}
            alt={`QR code for Table ${qrData.tableNumber}`}
            className="w-52 h-52 rounded-xl border border-gray-200"
          />
          <p className="text-sm text-gray-500 text-center">
            Scan to order from Table {qrData.tableNumber}
          </p>
        </div>

        {/* URL preview */}
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500 break-all border border-gray-200">
          {qrData.qrUrl}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            📋 Copy Link
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            ⬇ Download
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTableModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    number: '',
    capacity: '4',
    location: 'indoor',
    status: 'available',
  });
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const number = Number(form.number);
    const capacity = Number(form.capacity);

    if (!Number.isInteger(number) || number < 1) {
      toast.error('Table number must be a positive whole number');
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      toast.error('Capacity must be at least 1');
      return;
    }

    setSaving(true);
    try {
      await createTable({
        number,
        capacity,
        location: form.location,
        status: form.status,
      });
      toast.success(`Table ${number} created`);
      onCreated();
      onClose();
    } catch (err) {
      const message = err.response?.data?.message;
      toast.error(message || 'Failed to create table');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Add Table</h3>
            <p className="text-sm text-gray-500 mt-0.5">Table ID is generated automatically, like TABLE-0001.</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.number}
                onChange={(e) => set('number', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="12"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="4"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="bar">Bar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const [tables, setTables] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [qrModal, setQrModal] = useState(null); // qrData object or null
  const [qrLoading, setQrLoading] = useState(null); // tableId being loaded
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

  const showQR = async (tableId) => {
    setQrLoading(tableId);
    try {
      const data = await fetchTableQR(tableId);
      setQrModal(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate QR code');
    } finally {
      setQrLoading(null);
    }
  };

  const removeTable = async (table) => {
    if (table.currentOrder || table.status === 'occupied') {
      toast.error('Cannot delete a table with an active order');
      return;
    }

    const label = tableDisplayId(table);
    if (!confirm(`Delete ${label}?`)) return;

    try {
      await deleteTable(table._id);
      toast.success(`${label} deleted`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete table');
    }
  };

  const stats = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied:  tables.filter((t) => t.status === 'occupied').length,
    reserved:  tables.filter((t) => t.status === 'reserved').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Tables</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
          >＋ Add Table</button>
          <button
            onClick={() => navigate('/pos')}
            className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >🧾 Open POS</button>
        </div>
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
          const isLoadingQR = qrLoading === table._id;
          return (
            <div
              key={table._id}
              className={`rounded-xl border-2 p-4 space-y-2 transition-all ${style.card}`}
            >
              {/* Table number + location */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-2xl font-bold text-gray-800">{table.number}</span>
                  <p className="text-[11px] font-bold text-gray-400">{tableDisplayId(table)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{LOCATION_ICONS[table.location]}</span>
                  <button
                    onClick={() => removeTable(table)}
                    disabled={table.status === 'occupied' || !!table.currentOrder}
                    title={table.status === 'occupied' || table.currentOrder ? 'Cannot delete a table with an active order' : 'Delete table'}
                    className="rounded-md bg-white/80 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-white/80"
                  >
                    Delete
                  </button>
                </div>
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
                  <p className="text-orange-600 font-semibold">{formatCurrency(table.currentOrder.totalAmount)}</p>
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

              {/* QR button */}
              <button
                onClick={() => showQR(table._id)}
                disabled={isLoadingQR}
                className="w-full text-xs bg-gray-800 text-white rounded-lg py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isLoadingQR ? '…' : '📱 Show QR'}
              </button>
            </div>
          );
        })}
      </div>

      {/* QR Modal */}
      {showAddModal && (
        <AddTableModal
          onClose={() => setShowAddModal(false)}
          onCreated={load}
        />
      )}
      {qrModal && <QRModal qrData={qrModal} onClose={() => setQrModal(null)} />}
    </div>
  );
}
