# UI Context

## Theme

The design language is a clean, modern, and accessible workspace built around a primary teal brand color, utilizing "surface" backgrounds and "ink" body text. The interface uses specific semantic colorways to denote the 5 stages of the pipeline: Enquiry (Blue), Fact-Find (Orange), Research (Green), DIP (Purple), and Offer (Rose).

## Colors

All components must use these Tailwind custom tokens. No hardcoded hex values.

| Role               | Tailwind Token      | Hex       | Usage                                |
| ------------------ | ------------------- | --------- | ------------------------------------ |
| Brand Primary      | `brand.teal-700`    | `#0F6E56` | H1 headings, CTA buttons, nav logo   |
| Brand Hover/Accent | `brand.teal-500`    | `#1D9E75` | Hover states, active nav             |
| Brand Highlight    | `brand.teal-400`    | `#5DCAA5` | Hero text highlight, score bars      |
| Brand Light        | `brand.teal-100`    | `#9FE1CB` | Avatar backgrounds                   |
| Brand Faded        | `brand.teal-50`     | `#E1F5EE` | Active nav bg, teal-bg cards         |
| Body Text          | `ink`               | `#0D1F1A` | General body text                    |
| Background Surface | `surface`           | `#F7FBF9` | Dashboard page background            |

### Stage Colorways
- **Enquiry**: `stage.enquiry.bg` (#EFF6FF) / `stage.enquiry.text` (#1D4ED8)
- **Fact-Find**: `stage.factfind.bg` (#FFF7ED) / `stage.factfind.text` (#C2410C)
- **Research**: `stage.research.bg` (#F0FDF4) / `stage.research.text` (#166534)
- **DIP**: `stage.dip.bg` (#FAF5FF) / `stage.dip.text` (#7E22CE)
- **Offer**: `stage.offer.bg` (#FFF1F2) / `stage.offer.text` (#BE123C)

## Typography

| Role      | Font                | Weights            | Usage                         |
| --------- | ------------------- | ------------------ | ----------------------------- |
| Headings  | Syne (Google Fonts) | 400, 600, 700, 800 | H1 (56-60px), H2 (42px), etc. |
| Body      | DM Sans             | 300, 400, 500      | Base 14px, line-height 1.65   |
| Code/Mono | Courier New         | System Default     | Code blocks only              |

## Component Library

shadcn/ui serves as the base component library (`npx shadcn@latest init`). Custom components are built on top of these primitives, never replacing them. Components are organized into:
- `components/ui/` (primitives)
- `components/marketing/` (landing page)
- `components/dashboard/` (app shell and dashboard tools)

## Layout Patterns

- **Kanban Pipeline**: A 5-column drag-and-drop board (using `@dnd-kit/core`) applying the stage colorways.
- **Case Detail View**: A full-screen overlay (replacing dashboard content) featuring a top header with back arrow, and 5 sub-tabs (Overview, Documents, Compliance, Messages, AI Report) controlled by URL query params.
- **Messages Hub**: A 2-panel layout with a 300px fixed left scrollable conversation list, and a flexible right thread view.
- **Calculators Grid**: A 2x4 grid of calculator selection cards with an active calculator panel below. Reactive forms using `react-hook-form` without submit buttons.
- **Slide-overs and Modals**: Used for creating new clients and cases, featuring inline Zod validation.
