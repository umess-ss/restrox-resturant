import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { onboardRestaurant } from '../api/saas.api.js';
import useAuthStore from '../store/authStore.js';

const PLANS = [
  { key: 'trial',   label: 'Free Trial',  price: '$0',   period: '14 days', features: ['1 branch', '5 staff', '500 orders/mo'] },
  { key: 'starter', label: 'Starter',     price: '$49',  period: '/month',  features: ['1 branch', '20 staff', '5,000 orders/mo'] },
  { key: 'growth',  label: 'Growth',      price: '$149', period: '/month',  features: ['3 branches', '50 staff', '50,000 orders/mo', 'Payroll module'] },
  { key: 'enterprise', label: 'Enterprise', price: 'Custom', period: '',   features: ['Unlimited branches', 'Unlimited staff', 'Priority support', 'Custom integrations'] },
];

export default function OnboardPage() {
  const [step, setStep] = useState(1); // 1=plan, 2=details, 3=done
  const [selectedPlan] = useState('trial'); // trial is always the start
  const [form, setForm] = useState({
    restaurantName: '', ownerName: '', ownerEmail: '', ownerPassword: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    currency: 'USD',
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type} value={form[key]} required={required}
        onChange={(e) => set(key, e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">🍴 RestroX</h1>
          <p className="text-gray-400 mt-2">Restaurant Management Platform</p>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white text-center">Choose your plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className={`bg-white rounded-2xl p-5 cursor-pointer transition-all border-2 ${
                    plan.key === 'trial' ? 'border-orange-400 shadow-lg shadow-orange-500/20' : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => setStep(2)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-gray-800">{plan.label}</span>
                    {plan.key === 'trial' && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Recommended</span>
                    )}
                  </div>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                        <span className="text-green-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setStep(2)}
                    className={`w-full mt-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      plan.key === 'trial'
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {plan.key === 'enterprise' ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-center text-gray-400 text-sm">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-orange-400 hover:text-orange-300 font-medium">
                Sign in
              </button>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg mx-auto">
            <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-600 text-sm mb-4">← Back</button>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Set up your restaurant</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 font-medium">
                🎉 Starting with 14-day free trial — no credit card required
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Restaurant</p>
                {field('Restaurant Name', 'restaurantName')}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select value={form.currency} onChange={(e) => set('currency', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                      {['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                    <input value={form.timezone} onChange={(e) => set('timezone', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Owner Account</p>
                {field('Your Name', 'ownerName')}
                <div className="mt-3">{field('Email', 'ownerEmail', 'email')}</div>
                <div className="mt-3">{field('Password', 'ownerPassword', 'password')}</div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-orange-500 text-white rounded-xl py-3 font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors mt-2"
              >
                {loading ? 'Creating your restaurant...' : 'Create Restaurant & Start Free Trial'}
              </button>

              <p className="text-xs text-center text-gray-400">
                By signing up you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
