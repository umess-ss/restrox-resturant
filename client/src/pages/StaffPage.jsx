import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios.js';

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  waiter: 'bg-blue-100 text-blue-700',
  chef: 'bg-orange-100 text-orange-700',
};

export default function StaffPage() {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    api.get('/staff').then((r) => setStaff(r.data)).catch(() => toast.error('Failed to load staff'));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Staff</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${ROLE_COLORS[s.role]}`}>
                    {s.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
