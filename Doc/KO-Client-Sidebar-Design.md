# KO Client Portal — Sidebar Design Spec

> **Source of truth:** Live demo dashboard sidebar in `apps/web/components/marketing/live-demo-page.tsx` (embedded React nav, lines ~1978–2030).  
> **Client adaptation:** Same visual system, different nav items (4 links, no section labels, no plan footer).

Use this document when building `client-dashboard-nav.tsx` in the **KO-Client** repo.

---

## 1. Visual reference

```
┌─────────────────────────────┐
│  [🏠] KO Platform           │  ← Logo block
│                             │
│  ┌───────────────────────┐  │
│  │ [▦]  Overview         │  │  ← Active: cyan pill
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ [💼] My Application     │  │  ← Inactive
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ [💬] Messages           │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ [💼] Mortgage Tools     │  │
│  └───────────────────────┘  │
│                             │
│         (flex spacer)       │
└─────────────────────────────┘
```

**Broker live demo** uses the same pill nav but with 7 items + section labels in the HTML prototype. **Client portal** drops sections and the “Professional / KO Financials” footer card.

---

## 2. Layout & dimensions

| Property | Value | Notes |
|----------|-------|-------|
| Sidebar width (desktop) | `254px` | `lg:w-[254px]` |
| Sidebar height | `min-h-dvh` | Full viewport, sticky |
| Background | `#FFFFFF` | `bg-white` |
| Border | `#E4E4E4` | Right border on desktop; bottom on mobile |
| Padding | `py-[27px] pl-[14px] pr-[14px]` | |
| Logo → nav gap | `136px` | Large vertical gap (live demo) |
| Nav item gap | `19px` | Between pills |
| Main content | `flex-1 min-w-0` | Scrollable area to the right |

### Responsive

| Breakpoint | Behaviour |
|------------|-----------|
| `< lg` | Sidebar full width, horizontal stack above content, `border-b` |
| `≥ lg` | Fixed left column, `lg:sticky lg:top-0`, `border-r` |

---

## 3. Logo block

Match live demo exactly:

| Element | Spec |
|---------|------|
| Container | `flex items-center gap-2` |
| Icon wrapper | `rounded-md bg-brand-teal p-1.5` (`#0F6E56`) |
| Icon | Lucide `Building2`, `h-5 w-5 text-white` |
| Wordmark | `font-display text-xl font-bold tracking-tight text-brand-teal` |
| Text | **KO Platform** |
| Link target | `/overview` (client home) |

> Client mockup shows a house glyph — acceptable alternative: inline SVG with `fill="#1D9E75"` (see `live-demo-prototype-v2a.html` footer logo). Prefer **Building2** for parity with signed-in broker dashboard.

---

## 4. Navigation items (client)

| Label | Route | Icon | Asset |
|-------|-------|------|-------|
| Overview | `/overview` | 2×2 grid | Copy `/assets/dashboard_customize.svg` from broker |
| My Application | `/application` | Briefcase | Lucide `Briefcase` |
| Messages | `/messages` | Chat bubble | Copy `/assets/chat.svg` from broker |
| Mortgage Tools | `/tools` | Briefcase or calculator | Lucide `Briefcase` or `Calculator` |

**Do not include** (broker-only): Clients, Cases, Compliance, AI Reports, Settings, plan footer.

Optional: unread badge on Messages (`badge-blue` pattern from HTML prototype — `#2563EB` pill, white text, `10px` bold).

---

## 5. Nav pill — states

### Inactive

```css
/* Container */
width: 100%;
display: flex;
align-items: center;
gap: 8px;
padding: 6px 14px;
border-radius: 32px;
border: 1px solid transparent;
background: #FFFFFF;
color: #061F18;
font-size: 13px;
font-weight: 500;

/* Hover */
background: #FAFAFA;

/* Icon wrapper */
border-radius: 34px;
padding: 8px;
background: rgba(242, 242, 242, 0.95);

/* Icon */
width: 24px;
height: 24px;
color: #535E5B;
```

### Active

```css
/* Container */
border: 1px solid #00B8D9;
background: #E9FCFF;
color: #061F18;

/* Icon wrapper */
background: rgba(255, 255, 255, 0.95);

/* Icon (SVG / Lucide) */
color: #00B8D9;
```

### Tailwind mapping (use in component)

| State | Classes |
|-------|---------|
| Base pill | `flex w-full items-center gap-2 rounded-[32px] px-[14px] py-[6px] text-left text-[13px] font-medium transition-colors` |
| Active pill | `border border-[#00B8D9] bg-[#E9FCFF] text-[#061F18]` |
| Inactive pill | `border border-transparent bg-white text-[#061F18] hover:bg-[#fafafa]` |
| Icon wrapper (active) | `rounded-[34px] bg-[rgba(255,255,255,0.95)] p-2` |
| Icon wrapper (inactive) | `rounded-[34px] bg-[rgba(242,242,242,0.95)] p-2` |

---

## 6. Reference component (copy into KO-Client)

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Briefcase, Calculator, type LucideIcon } from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  iconUrl?: string;
  icon?: LucideIcon;
};

const CLIENT_NAV: NavItem[] = [
  { label: 'Overview', href: '/overview', iconUrl: '/assets/dashboard_customize.svg' },
  { label: 'My Application', href: '/application', icon: Briefcase },
  { label: 'Messages', href: '/messages', iconUrl: '/assets/chat.svg' },
  { label: 'Mortgage Tools', href: '/tools', icon: Calculator },
];

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  const tone = active ? '#00B8D9' : '#535e5b';
  return (
    <span
      className={`flex shrink-0 items-center gap-2 rounded-[34px] p-2 ${
        active ? 'bg-[rgba(255,255,255,0.95)]' : 'bg-[rgba(242,242,242,0.95)]'
      }`}
    >
      {item.iconUrl ? (
        <img src={item.iconUrl} alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
      ) : item.icon ? (
        <item.icon className="h-6 w-6 shrink-0" style={{ color: tone }} aria-hidden />
      ) : null}
    </span>
  );
}

export function ClientDashboardNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className="flex w-full shrink-0 flex-col items-start gap-[136px] border-b border-[#E4E4E4] bg-white py-[27px] pr-[14px] pl-[14px] lg:sticky lg:top-0 lg:min-h-dvh lg:w-[254px] lg:self-start lg:border-r lg:border-b-0"
      aria-label="Client navigation"
    >
      <Link href="/overview" className="flex items-center gap-2" aria-label="KO Platform home">
        <div className="rounded-md bg-brand-teal p-1.5">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <span className="font-display text-xl font-bold tracking-tight text-brand-teal">
          KO Platform
        </span>
      </Link>

      <nav className="flex w-full flex-col items-start gap-[19px] self-stretch">
        {CLIENT_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-2 self-stretch rounded-[32px] px-[14px] py-[6px] text-left text-[13px] font-medium transition-colors ${
                active
                  ? 'border border-[#00B8D9] bg-[#E9FCFF] text-[#061F18]'
                  : 'border border-transparent bg-white text-[#061F18] hover:bg-[#fafafa]'
              }`}
            >
              <NavIcon item={item} active={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### Shell wrapper

```tsx
export function ClientDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <ClientDashboardNav />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

---

## 7. Assets to copy from KO-Broker

Copy into `apps/client/public/assets/`:

| File | Used by |
|------|---------|
| `dashboard_customize.svg` | Overview nav icon |
| `chat.svg` | Messages nav icon |
| `Dash-bg.png` | Optional main-area gradient background (overview) |

---

## 8. CSS tokens to add in client `globals.css`

Include broker brand tokens **plus** sidebar cyan accents:

```css
@theme {
  --color-brand-teal-700: #0F6E56;
  --color-brand-teal-500: #1D9E75;
  --color-brand-teal-50: #E1F5EE;
  --color-ink: #0D1F1A;
  --color-surface: #F7FBF9;

  /* Client sidebar active state (live demo) */
  --color-nav-active-border: #00B8D9;
  --color-nav-active-bg: #E9FCFF;
  --color-nav-icon-active: #00B8D9;
  --color-nav-icon-idle: #535E5B;
  --color-nav-text: #061F18;
}
```

---

## 9. Differences from broker sidebar

| Feature | Broker (`dashboard-nav.tsx` / live demo) | Client (`client-dashboard-nav.tsx`) |
|---------|------------------------------------------|-------------------------------------|
| Width | 220px (CRM nav) / **254px** (live demo) | **254px** (match live demo) |
| Active style | CRM: `brand-teal-50` + teal text | **Cyan pill** `#E9FCFF` + `#00B8D9` border |
| Section labels | "Main" / "Tools" | **None** |
| Nav count | 7–8 items | **4 items** |
| Plan footer | "Professional / KO Financials" | **Omit** |
| UserButton | In CRM nav header | Clerk avatar elsewhere or footer (optional) |
| Pill + icon chip | Live demo only | **Yes — required** |

---

## 10. Accessibility

- `<aside aria-label="Client navigation">`
- Logo link: `aria-label="KO Platform home"`
- Decorative icons: `alt=""` on `<img>`, `aria-hidden` on Lucide
- Active route: `aria-current="page"` on active `<Link>`
- Focus: visible ring using `focus-visible:ring-2 focus-visible:ring-[#00B8D9]`

---

## 11. Broker source files (for alignment)

| File | What to mirror |
|------|----------------|
| `apps/web/components/marketing/live-demo-page.tsx` | Sidebar layout, pill styles, icon chips |
| `apps/web/public/live-demo-prototype-v2a.html` | `.dash-sidebar`, `.dash-nav-item` (older sky-blue variant — **do not use** for client; use React live demo cyan) |
| `apps/web/app/globals.css` | Brand teal + surface tokens |
| `context/ui-context.md` | Typography (Syne / DM Sans) |

---

*KO Client Portal · Sidebar spec · Aligns with live demo v2a embedded nav*
