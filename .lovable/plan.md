

# Premium Security Operations Dashboard — Implementation Plan

This is a large-scope redesign of the Overview page and supporting components. The plan is organized into implementable chunks.

## What Changes

### 1. Enhanced Top Navigation Bar
**File: `src/components/AdminLayout.tsx`**
- Replace the minimal header with a richer top bar containing: breadcrumb (page title), system health pulse with "Last checked: 2m ago" timestamp, CMD+K search trigger button, and user avatar
- CMD+K opens a `CommandDialog` (already have `cmdk` + `command.tsx`) for searching IPs, users, alert IDs across mock data

### 2. New `CommandBar` Component
**New file: `src/components/CommandBar.tsx`**
- Uses existing `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`
- Registers `Cmd+K` / `Ctrl+K` keyboard shortcut
- Searches across mock alerts (by title, IP, actor), sessions, audit events
- Results grouped by category with icons

### 3. Redesigned MetricCard with Sparklines & Info Tooltips
**File: `src/components/MetricCard.tsx`**
- Add `tooltip` prop (string) — renders a `HelpCircle` icon in top-right that shows definition on hover
- Add `sparkline` prop (number array) — renders a tiny inline SVG line chart (no library needed, just a polyline)
- Add `trend` prop (`{ value: number, direction: "up" | "down" }`) — shows "↑ 12% vs last week" text
- Add `anomaly` prop (boolean) — pulses card border in amber when metric is abnormally high
- Surface design: switch from `surface-card` box-shadow to `1px border border-border/50` with subtle `backdrop-blur` on hover

### 4. Overhauled OverviewPage Layout
**File: `src/pages/admin/OverviewPage.tsx`**
- **Hero Metrics** (4-col grid): Login Failures, Active Sessions, Open Alerts, MTTA/MTTR — each with sparkline data, info tooltip, and trend indicator
- **70/30 split main area**: Left = enhanced heatmap with tab controls; Right = "Top Threat Sources" compact list
- **Bottom panel**: Recent alerts stream with severity color-coded left border, hover quick-actions, source IP/affected user inline
- Group secondary metrics into a labeled "Performance" cluster
- Status pill enhanced: pulse animation + "Last checked: 2 mins ago"

### 5. Enhanced AuthHeatmap
**File: `src/components/AuthHeatmap.tsx`**
- 5-step color gradient (gray → yellow → orange → red → crimson) instead of binary green/red
- Tab bar above heatmap to toggle between "Auth Failures", "Latency", "Traffic Volume" (mock data for each)
- Tooltip already exists; ensure it shows exact counts clearly

### 6. Enhanced AlertCard
**File: `src/components/AlertCard.tsx`**
- Add thick left border color-coded by severity (red=critical, orange=high, amber=warning, blue=info)
- Show source IP and affected user inline in summary
- Quick-action buttons (Acknowledge, Investigate, Dismiss) appear on hover with smooth fade-in
- Extract IP/user from `alert.details` for inline display

### 7. Mock Data Expansion
**File: `src/lib/mock-data.ts`**
- Add sparkline arrays (60 data points per metric representing last 60 min)
- Add trend percentages
- Add "Top Threat Sources" list (IP, country, hit count)
- Add latency/traffic heatmap variant data

### 8. CSS & Theme Refinements
**File: `src/index.css`**
- Background: `--background` to soft slate `#F8FAFC` (210 40% 98%)
- Add `--anomaly` amber color token
- Add `@keyframes border-pulse` for anomaly highlighting
- Refine `surface-card` to use semi-transparent 1px borders instead of box-shadows
- Add glassmorphism utility: `backdrop-blur-sm bg-white/80`

**File: `tailwind.config.ts`**
- Add `border-pulse` animation keyframe
- Add `anomaly` color token

## Technical Notes

- Sparklines are pure SVG `<polyline>` elements — no charting library needed
- CMD+K uses the existing `cmdk` package and `CommandDialog` component
- All data remains mock; structure is ready for API integration
- Framer Motion animations preserved with existing easing curves
- The 70/30 layout uses CSS grid: `grid-cols-[1fr_340px]` on `lg:` breakpoint, stacks on mobile

## Implementation Order
1. Theme/CSS updates (foundation)
2. Mock data expansion (data layer)
3. MetricCard redesign (reusable component)
4. CommandBar component (independent)
5. Enhanced AlertCard (independent)
6. Enhanced AuthHeatmap (independent)
7. OverviewPage layout rebuild (ties everything together)
8. AdminLayout top nav update (integrates CommandBar)

