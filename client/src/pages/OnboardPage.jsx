import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { onboardRestaurant } from '../api/saas.api.js';
import useAuthStore from '../store/authStore.js';

const PLANS = [
  { key: 'trial',   label: 'Free Trial',  price: 'Rs. 0',      period: '14 days', features: ['1 branch', '5 staff', '500 orders/mo'] },
  { key: 'starter', label: 'Starter',     price: 'Rs. 4,900',  period: '/month',  features: ['1 branch', '20 staff', '5,000 orders/mo'] },
  { key: 'growth',  label: 'Growth',      price: 'Rs. 14,900', period: '/month',  features: ['3 branches', '50 staff', '50,000 orders/mo', 'Payroll module'] },
  { key: 'enterprise', label: 'Enterprise', price: 'Custom', period: '',   features: ['Unlimited branches', 'Unlimited staff', 'Priority support', 'Custom integrations'] },
];

export default function OnboardPage() {
  const [step, setStep] = useState(1); // 1=plan, 2=details, 3=done
  const [selectedPlan] = useState('trial'); // trial is always the start
  const [form, setForm] = useState({
    restaurantName: '', ownerName: '', ownerEmail: '', ownerPassword: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    currency: 'NPR',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onboardRestaurant({ ...form });
      // Auto-login after onboarding
      await login(form.ownerEmail, form.ownerPassword);
      toast.success(`Welcome to ${form.restaurantName}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, type = 'text', required = true) => (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#111827]">{label}</label>
      <input
        type={type} value={form[key]} required={required}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#F97316] focus:ring-4 focus:ring-[#FFEDD5]"
      />
    </div>
  );

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
          className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-restrox transition hover:border-[#F97316] hover:text-[#F97316]"
          to="/login"
        >
          Sign in
        </Link>
      </header>

      <main className="relative flex min-h-[calc(100vh-76px)] items-center justify-center px-4 py-12 md:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#FFF7ED] via-[#FFFBF5] to-white" />
        <div className="absolute right-12 top-16 -z-10 h-64 w-64 rounded-full bg-[#FFEDD5]/70 blur-3xl" />
        <div className="w-full max-w-5xl">
          <div className="mb-8 text-center">
            <p className="mb-4 inline-flex rounded-full border border-[#FED7AA] bg-[#FFEDD5] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#F97316]">
              Start free with RestroX
            </p>
            <h1 className="text-4xl font-bold text-[#111827]">Restaurant Management Platform</h1>
            <p className="mx-auto mt-3 max-w-2xl text-[#6B7280]">
              Choose a plan and create your restaurant workspace in minutes.
            </p>
          </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-center text-xl font-bold text-[#111827]">Choose your plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={`cursor-pointer rounded-3xl border bg-white p-5 shadow-restrox transition-all hover:-translate-y-1 hover:border-[#FED7AA] hover:shadow-restrox-lg ${
                    plan.key === selectedPlan ? 'border-[#F97316] shadow-restrox-lg' : 'border-[#E5E7EB]'
                  }`}
                  onClick={() => setStep(2)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-[#111827]">{plan.label}</span>
                    {plan.key === selectedPlan && (
                      <span className="rounded-full bg-[#FFEDD5] px-2 py-0.5 text-xs font-bold text-[#F97316]">Recommended</span>
                    )}
                  </div>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-[#111827]">{plan.price}</span>
                    <span className="text-sm text-[#6B7280]">{plan.period}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                        <span className="text-[#F97316]">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setStep(2)}
                    className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition-colors ${
                      plan.key === selectedPlan
                        ? 'bg-[#F97316] text-white hover:bg-[#EA580C]'
                        : 'border border-[#E5E7EB] text-[#111827] hover:border-[#F97316] hover:bg-[#FFF7ED]'
                    }`}
                  >
                    {plan.key === 'enterprise' ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-[#6B7280]">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="font-bold text-[#F97316] hover:text-[#EA580C]">
                Sign in
              </button>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto max-w-lg rounded-[2rem] border border-[#E5E7EB] bg-white/95 p-6 shadow-restrox-xl backdrop-blur sm:p-8">
            <button onClick={() => setStep(1)} className="mb-4 text-sm font-semibold text-[#F97316] hover:text-[#EA580C]">← Back</button>
            <h2 className="mb-2 text-2xl font-bold text-[#111827]">Set up your restaurant</h2>
            <p className="mb-6 text-sm text-[#6B7280]">Create your owner account and trial workspace.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-[#FED7AA] bg-[#FFEDD5] p-3 text-sm font-bold text-[#F97316]">
                🎉 Starting with 14-day free trial — no credit card required
              </div>

              <div className="border-t border-[#E5E7EB] pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6B7280]">Restaurant</p>
                {field('Restaurant Name', 'restaurantName')}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#111827]">Currency</label>
                    <select value={form.currency} onChange={(e) => set('currency', e.target.value)}
                      className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm text-[#111827] outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#FFEDD5]">
                      {['NPR'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#111827]">Timezone</label>
                    <input value={form.timezone} onChange={(e) => set('timezone', e.target.value)}
                      className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-sm text-[#111827] outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#FFEDD5]" />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E5E7EB] pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6B7280]">Owner Account</p>
                {field('Your Name', 'ownerName')}
                <div className="mt-3">{field('Email', 'ownerEmail', 'email')}</div>
                <div className="mt-3">{field('Password', 'ownerPassword', 'password')}</div>
              </div>

              <button
                type="submit" disabled={loading}
                className="mt-2 w-full rounded-xl bg-[#F97316] py-3 font-bold text-white shadow-restrox-lg transition-colors hover:bg-[#EA580C] disabled:opacity-50"
              >
                {loading ? 'Creating your restaurant...' : 'Create Restaurant & Start Free Trial'}
              </button>

              <p className="text-center text-xs text-[#6B7280]">
                By signing up you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>
        )}
        </div>
      </main>
      </div>
  );
}
