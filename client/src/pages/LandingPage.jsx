import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Order & KOT Management',
    icon: 'KOT',
    body: 'Send orders to the kitchen in seconds with live status updates for chefs and servers.',
  },
  {
    title: 'QR Menu & Online Ordering',
    icon: 'QR',
    body: 'Let guests browse menus, place orders, and follow their order flow from their own phones.',
  },
  {
    title: 'Table & Space Management',
    icon: 'TB',
    body: 'Track table occupancy, open checks, and floor activity from a simple operational view.',
  },
  {
    title: 'Inventory & Stock Control',
    icon: 'ST',
    body: 'Monitor ingredients, low-stock alerts, and purchasing needs before service gets busy.',
  },
  {
    title: 'Staff & Role Management',
    icon: 'HR',
    body: 'Assign permissions by role and keep managers, waiters, chefs, and cashiers focused.',
  },
  {
    title: 'Sales Reports & Finance',
    icon: 'RP',
    body: 'Review daily revenue, payment mix, tax totals, and performance from clean reports.',
  },
];

const steps = [
  ['Create account', 'Set up your restaurant profile and choose your trial plan.'],
  ['Add your menu', 'Create categories, items, prices, tables, and staff roles.'],
  ['Start selling', 'Take orders, print KOTs, manage tables, and review reports.'],
];

const stats = [
  ['5+', 'Years of innovation'],
  ['100+', 'Operational features'],
  ['10k+', 'Monthly active users'],
];

function DashboardMockup() {
  return (
    <div className="rounded-[2rem] border border-[#E5E7EB] bg-white p-3 shadow-restrox-xl">
      <div className="overflow-hidden rounded-[1.5rem] border border-[#E5E7EB] bg-[#FFFBF5]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#F97316]" />
            <span className="h-3 w-3 rounded-full bg-[#FFEDD5]" />
            <span className="h-3 w-3 rounded-full bg-[#FFF7ED]" />
          </div>
          <div className="h-2 w-28 rounded-full bg-[#FED7AA]" />
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-[0.75fr_1.25fr_1fr]">
          <div className="space-y-3 rounded-2xl bg-[#111827] p-4 text-white">
            {['Dashboard', 'Orders', 'Tables', 'Inventory', 'Reports'].map((item, index) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 text-sm ${
                  index === 1 ? 'bg-[#F97316] text-white' : 'bg-white/10 text-white/75'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-restrox">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Today</p>
                <p className="mt-2 text-2xl font-bold text-[#111827]">Rs. 84k</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-restrox">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Open orders</p>
                <p className="mt-2 text-2xl font-bold text-[#F97316]">32</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-restrox">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-semibold text-[#111827]">Sales trend</p>
                <span className="rounded-full bg-[#FFEDD5] px-3 py-1 text-xs font-semibold text-[#F97316]">
                  +18%
                </span>
              </div>
              <div className="flex h-32 items-end gap-2">
                {[42, 56, 38, 74, 68, 88, 78].map((height, index) => (
                  <span
                    key={height + index}
                    className="flex-1 rounded-t-xl bg-gradient-to-t from-[#F97316] to-[#FFEDD5]"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {['Table 4', 'Takeaway', 'Table 9', 'Delivery'].map((order, index) => (
              <div key={order} className="rounded-2xl bg-white p-4 shadow-restrox">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#111827]">{order}</p>
                  <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-xs font-semibold text-[#F97316]">
                    {index % 2 === 0 ? 'Cooking' : 'New'}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#FED7AA]">
                  <div className="h-2 rounded-full bg-[#F97316]" style={{ width: `${55 + index * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFFBF5] text-[#111827]">
      <header className="sticky top-3 z-50 mx-auto flex w-[calc(100%-32px)] max-w-7xl items-center justify-between rounded-full border border-[#E5E7EB] bg-white/90 px-4 py-3 shadow-restrox backdrop-blur md:px-6">
        <a href="#top" className="text-xl font-bold text-[#F97316]">
          RestroX
        </a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#6B7280] md:flex">
          <a className="transition hover:text-[#F97316]" href="#features">Features</a>
          <a className="transition hover:text-[#F97316]" href="#workflow">How it works</a>
          <a className="transition hover:text-[#F97316]" href="#stats">Stats</a>
          <a className="transition hover:text-[#F97316]" href="#contact">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#6B7280] transition hover:text-[#F97316] sm:inline-flex" to="/login">
            Sign in
          </Link>
          <Link className="rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-restrox transition hover:bg-[#EA580C]" to="/onboard">
            Start free
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="relative px-4 pb-16 pt-16 md:pb-24 md:pt-20">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#FFF7ED] via-[#FFFBF5] to-white" />
          <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
            <div className="mb-5 inline-flex items-center rounded-full border border-[#FED7AA] bg-[#FFEDD5] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#EA580C]">
              Nepal's trusted restaurant POS
            </div>
            <h1 className="max-w-5xl text-4xl font-bold leading-tight text-[#111827] md:text-6xl">
              Restaurant management software made for{' '}
              <span className="text-[#F97316]">modern hospitality teams</span>
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#6B7280] md:text-lg">
              Manage orders, billing, KOT, tables, QR menus, inventory, staff, and reports from one calm dashboard built for growing restaurants.
            </p>
            <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Link className="rounded-xl bg-[#F97316] px-7 py-3 text-center text-sm font-bold text-white shadow-restrox-lg transition hover:bg-[#EA580C]" to="/onboard">
                Start free trial
              </Link>
              <Link className="rounded-xl border border-[#E5E7EB] bg-white px-7 py-3 text-center text-sm font-bold text-[#111827] shadow-restrox transition hover:border-[#F97316] hover:text-[#F97316]" to="/login">
                View demo dashboard
              </Link>
            </div>
            <div className="mt-12 w-full max-w-6xl">
              <DashboardMockup />
            </div>
          </div>
        </section>

        <section className="border-y border-[#E5E7EB] bg-white py-10">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.24em] text-[#6B7280]">
              Trusted by restaurants, cafes, and cloud kitchens
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-lg font-bold text-[#6B7280] md:text-2xl">
              <span>Kaffeine</span>
              <span>Bajeko Sekuwa</span>
              <span>Roadhouse</span>
              <span>The Burger House</span>
              <span>CloudDine</span>
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#FFF7ED] px-4 py-16 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-[#111827] md:text-4xl">Everything your restaurant needs in one system</h2>
              <p className="mt-3 text-[#6B7280]">From table service to financial reporting, RestroX keeps daily operations organized.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-restrox transition hover:-translate-y-1 hover:border-[#FED7AA] hover:shadow-restrox-lg">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFEDD5] text-sm font-black text-[#F97316]">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#111827]">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-[#6B7280]">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-[#E5E7EB] bg-gradient-to-br from-[#FFEDD5] to-white shadow-restrox-lg lg:grid-cols-2">
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold leading-tight text-[#111827] md:text-4xl">Manage orders effortlessly</h2>
              <div className="mt-8 space-y-4">
                {[
                  'Real-time order tracking from server app to kitchen display.',
                  'Fast billing with split payments and clear table history.',
                  'Simple workflows for dine-in, takeaway, and delivery orders.',
                ].map((item) => (
                  <p key={item} className="flex gap-3 text-[#6B7280]">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-xs font-bold text-white">✓</span>
                    <span>{item}</span>
                  </p>
                ))}
              </div>
              <Link className="mt-8 inline-flex rounded-full bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-restrox transition hover:bg-[#EA580C]" to="/onboard">
                Explore order management
              </Link>
            </div>
            <div className="bg-white/45 p-6 md:p-10">
              <div className="grid h-full min-h-[360px] content-center gap-4">
                {['New orders', 'Kitchen queue', 'Ready to serve'].map((title, index) => (
                  <div key={title} className="rounded-3xl bg-white p-5 shadow-restrox">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#111827]">{title}</h3>
                      <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-bold text-[#F97316]">{8 - index * 2} items</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((item) => (
                        <span key={item} className="h-16 rounded-2xl bg-[#FED7AA]" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-[#FFF7ED]/70 px-4 py-16 md:py-24">
          <div className="mx-auto max-w-7xl text-center">
            <h2 className="text-3xl font-bold text-[#111827] md:text-4xl">Start managing your restaurant in minutes</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map(([title, body], index) => (
                <div key={title} className="flex flex-col items-center">
                  <div className="mb-5 rounded-3xl border border-[#E5E7EB] bg-white px-8 py-7 shadow-restrox">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#F97316] bg-[#FFEDD5] text-2xl font-bold text-[#F97316] shadow-restrox">
                    {index + 1}
                    </div>
                    <h3 className="text-xl font-bold text-[#111827]">{title}</h3>
                    <p className="mt-3 max-w-sm leading-7 text-[#6B7280]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="stats" className="bg-[#FFFBF5] px-4 py-16">
          <div className="mx-auto grid max-w-7xl gap-8 text-center md:grid-cols-3">
            {stats.map(([number, label]) => (
              <div key={label}>
                <p className="text-5xl font-black text-[#F97316] md:text-6xl">{number}</p>
                <p className="mt-2 text-sm font-bold uppercase tracking-wide text-[#6B7280]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="px-4 py-16 md:py-24">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[#FED7AA] bg-gradient-to-br from-[#F97316] to-[#EA580C] px-6 py-14 text-center shadow-restrox-xl md:px-12">
            <h2 className="mx-auto max-w-4xl text-3xl font-bold leading-tight text-white md:text-5xl">
              Ready to simplify your restaurant operations?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#FFEDD5]">
              Join hospitality teams using RestroX to run smoother service, cleaner billing, and smarter stock control.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link className="rounded-full bg-white px-8 py-3 text-sm font-bold text-[#F97316] shadow-restrox transition hover:bg-[#FFF7ED]" to="/onboard">
                Start for free
              </Link>
              <Link className="rounded-full border border-white/70 px-8 py-3 text-sm font-bold text-white transition hover:bg-white/10" to="/login">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E5E7EB] bg-white px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <div>
            <p className="text-lg font-bold text-[#F97316]">RestroX</p>
            <p className="mt-1 text-sm text-[#6B7280]">Restaurant management software for modern teams.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold text-[#6B7280]">
            <a className="hover:text-[#F97316]" href="#features">Features</a>
            <a className="hover:text-[#F97316]" href="#workflow">How it works</a>
            <Link className="hover:text-[#F97316]" to="/login">Login</Link>
            <Link className="hover:text-[#F97316]" to="/onboard">Start free</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
