import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchFeedback, createFeedback } from '../api/feedback.api.js';

const ratingOptions = ['', '5', '4', '3', '2', '1'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function FeedbackChart({ data }) {
  const max = Math.max(...data.flatMap((m) => [m.positive, m.bad]), 10);

  return (
    <div className="h-72 overflow-x-auto">
      <div className="flex h-full min-w-[720px] items-end gap-5 border-b border-gray-200 px-4 pb-8">
        {data.map((month) => (
          <div key={month.month} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-56 items-end gap-2">
              <div
                className="w-3 rounded-t-full bg-red-400"
                style={{ height: `${Math.max((month.bad / max) * 100, month.bad ? 8 : 2)}%` }}
                title={`Bad: ${month.bad}`}
              />
              <div
                className="w-3 rounded-t-full bg-orange-400"
                style={{ height: `${Math.max((month.positive / max) * 100, month.positive ? 8 : 2)}%` }}
                title={`Positive: ${month.positive}`}
              />
            </div>
            <span className="text-xs font-semibold text-gray-400">{month.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackCard({ item }) {
  const initials = (item.customerName || 'Guest')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="text-orange-400">{'★'.repeat(item.rating)}<span className="text-gray-200">{'★'.repeat(5 - item.rating)}</span></div>
      <h3 className="mt-4 text-sm font-extrabold text-gray-900">
        {item.comment ? item.comment.split('.').filter(Boolean)[0] : 'Guest feedback'}
      </h3>
      <p className="mt-3 line-clamp-3 min-h-[4rem] text-sm leading-relaxed text-gray-400">
        {item.comment || 'No written comment was added for this feedback.'}
      </p>
      <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-sm font-extrabold text-orange-700">
          {initials}
        </div>
        <div>
          <p className="font-extrabold text-gray-900">{item.customerName || 'Guest'}</p>
          <p className="text-xs text-gray-400">
            {item.order?.orderNumber ? `Ordered ${item.order.orderNumber}` : new Date(item.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </article>
  );
}

function AddFeedbackModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ customerName: '', customerPhone: '', rating: 5, comment: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createFeedback({ ...form, rating: Number(form.rating) });
      toast.success('Feedback added');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Add Feedback</h2>
            <p className="text-sm text-gray-400">Record walk-in or verbal feedback.</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="space-y-4">
          <input
            value={form.customerName}
            onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
            placeholder="Customer name"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
          <input
            value={form.customerPhone}
            onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
            placeholder="Phone"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
          <select
            value={form.rating}
            onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          >
            {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
          </select>
          <textarea
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            placeholder="Comment"
            rows={4}
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button disabled={loading} className="rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function FeedbackPage() {
  const [data, setData] = useState({ items: [], summary: {}, chart: [] });
  const [rating, setRating] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchFeedback({ rating: rating || undefined, sentiment: sentiment || undefined, page, limit: 8 }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [rating, sentiment, page]);

  useEffect(() => { load(); }, [load]);

  const chart = data.chart?.length ? data.chart : monthNames.map((month) => ({ month, positive: 0, bad: 0 }));
  const summary = data.summary || {};
  const averageRating = useMemo(() => Number(summary.avgRating || 0).toFixed(1), [summary.avgRating]);

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-[#f7f7f7] p-4 lg:-m-6 lg:p-6">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Guest experience</p>
          <h1 className="mt-1 text-3xl font-extrabold text-gray-900">Feedback</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600"
        >Add Feedback</button>
      </div>

      <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-extrabold text-gray-900">Statistic</h2>
          <div className="flex items-center gap-3 text-xs font-semibold text-gray-400">
            <span><span className="text-orange-400">●</span> Positive</span>
            <span><span className="text-red-400">●</span> Bad</span>
          </div>
        </div>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_240px]">
          <FeedbackChart data={chart} />
          <div className="space-y-7">
            <div>
              <p className="text-sm text-gray-500">Average Rating</p>
              <p className="mt-2 text-3xl font-extrabold text-gray-900">{averageRating}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Positive Feedback</p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">{summary.positive || 0}</p>
              <p className="mt-2 text-xs font-bold text-orange-500">↑ Good reviews</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Bad Feedback</p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">{summary.bad || 0}</p>
              <p className="mt-2 text-xs font-bold text-red-400">↓ Needs attention</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-extrabold text-gray-900">Recent Feedback</h2>
          <div className="flex gap-2">
            <select
              value={sentiment}
              onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 outline-none focus:border-orange-300"
            >
              <option value="">Latest</option>
              <option value="positive">Positive</option>
              <option value="bad">Bad</option>
            </select>
            <select
              value={rating}
              onChange={(e) => { setRating(e.target.value); setPage(1); }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 outline-none focus:border-orange-300"
            >
              {ratingOptions.map((r) => <option key={r || 'all'} value={r}>{r ? `${r} star` : 'All Rating'}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white py-16 text-center text-gray-400 shadow-sm">Loading feedback...</div>
        ) : data.items?.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {data.items.map((item) => <FeedbackCard key={item._id} item={item} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-orange-200 bg-white py-16 text-center shadow-sm">
            <p className="font-bold text-gray-700">No feedback yet</p>
            <p className="mt-1 text-sm text-gray-400">Customer feedback will appear here.</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
          <span>Showing {data.items?.length || 0} from {data.total || 0} data</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-500 disabled:opacity-40"
            >‹</button>
            <span className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-white">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(data.pages || 1, p + 1))}
              disabled={page >= (data.pages || 1)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-500 disabled:opacity-40"
            >›</button>
          </div>
        </div>
      </section>

      {showAdd && <AddFeedbackModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  );
}
