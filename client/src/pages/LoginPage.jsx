import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../store/authStore.js';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reach backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFFBF5] text-[#111827]">
      <header className="sticky top-3 z-50 mx-auto flex w-[calc(100%-32px)] max-w-7xl items-center justify-between rounded-full border border-[#E5E7EB] bg-white/90 px-4 py-3 shadow-restrox backdrop-blur md:px-6">
        <Link to="/" className="text-xl font-bold text-[#F97316]">
          RestroX
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#6B7280] md:flex">
          <Link className="transition hover:text-[#F97316]" to="/">
            Home
          </Link>
          <a className="transition hover:text-[#F97316]" href="/#features">
            Features
          </a>
          <a className="transition hover:text-[#F97316]" href="/#contact">
            Contact
          </a>
        </nav>
        <Link
          className="rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-restrox transition hover:bg-[#EA580C]"
          to="/onboard"
        >
          Start free
        </Link>
      </header>

      <main className="relative flex min-h-[calc(100vh-76px)] items-center justify-center px-4 py-12 md:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#FFF7ED] via-[#FFFBF5] to-white" />
        <div className="absolute left-1/2 top-20 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-[#FFEDD5]/60 blur-3xl" />

        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">
          <section className="hidden lg:block">
            <Link
              to="/"
              className="mb-8 inline-flex text-sm font-semibold text-[#F97316] transition hover:text-[#EA580C]"
            >
              Back to home
            </Link>
            <p className="mb-4 inline-flex rounded-full border border-[#E5E7EB] bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#F97316] shadow-restrox">
              Restaurant operations hub
            </p>
            <h1 className="max-w-xl text-5xl font-bold leading-tight text-[#111827]">
              Pick up service right where your team left off.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#6B7280]">
              Sign in to manage orders, POS, KOT, tables, inventory, staff, and reporting from one calm RestroX workspace.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {['Live orders', 'Table status', 'Daily reports'].map((item) => (
                <div key={item} className="rounded-2xl border border-[#E5E7EB] bg-white/85 p-4 shadow-restrox">
                  <div className="mb-3 h-2 w-12 rounded-full bg-[#F97316]" />
                  <p className="text-sm font-bold text-[#111827]">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="w-full rounded-[2rem] border border-[#E5E7EB] bg-white/95 p-6 shadow-restrox-xl backdrop-blur sm:p-8"
          >
            <div className="mb-8 text-center">
              <Link to="/" className="inline-flex text-3xl font-bold text-[#F97316]">
                RestroX
              </Link>
              <h1 className="mt-4 text-2xl font-bold text-[#111827]">Welcome back</h1>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                Sign in to manage your restaurant operations
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#111827]">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="owner@restaurant.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#F97316] focus:ring-4 focus:ring-[#FFEDD5]"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#111827]">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#F97316] focus:ring-4 focus:ring-[#FFEDD5]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#F97316] px-4 py-3 text-sm font-bold text-white shadow-restrox-lg transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-[#6B7280]">
              New restaurant?{' '}
              <Link to="/onboard" className="font-bold text-[#F97316] transition hover:text-[#EA580C]">
                Start free trial
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
