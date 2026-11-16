# Proposal

Status: approved
Issue: diblaze/actual#14

## Why
Phones get 12px amounts that shrink to 6px, a drag-pill nav that hides six of nine destinations, centred dialogs and blocked zoom; 512–729px gets the desktop table with collapsed columns. Denis approved a responsive redesign canvas in Actual's default theme colours and wants it in the fork, next to the credit-card features, on his live instance.

## What Changes
- Phone layout applies up to 729px wide (today: up to 511px); tablet layout from 730px to 1099px.
- **BREAKING** (fork UI only) Phone nav becomes a floating glass tab bar with Budget, Transactions, Accounts, Reports and More, plus a floating "Add" button; drag pill and hide-on-scroll removed; More opens a sheet with the other destinations.
- Phone pages use a 34px large title under round glass header buttons; content sits in rounded cards on the page background; the purple header bar goes.
- Phone dialogs open as bottom sheets named by their title; long-list pickers fill the screen; pinch zoom allowed; inputs at least 16px on touch screens.
- Phone budget: group cards with Budgeted and Balance totals, coloured Balance pills (positive, warning, overspent, zero), To budget card ("Move", or "Cover" when overbudgeted), "Categories overspent → Fix" and "Uncategorized → Show" banners, category sheet with Balance, Budgeted, Spent, spent bar, Cover/Move money and recent transactions.
- Carried card debt keeps rendering red; this month's uncovered card spending and unfunded card payments keep the warning colour.
- Phone transactions: Transactions tab for all accounts, rows with category chip and imported payee line, Upcoming section, day totals, labelled cleared state; the editor is a bottom sheet over the dimmed previous screen with a purple amount header, Expense/Income/Transfer control, grouped field cards and one full-width "Add transaction" button with "Save + new" beside it, and recent payee chips.
- Phone manage screens: accounts as grouped cards with totals, Synced/Manual pills and a new-transactions dot, fixed-size report numbers, overdue schedules first with Mark paid/Skip, payee letter index and duplicate suggestion, rules as sentences, theme segmented control; card-debt toggle stays reachable.
- Tablet: glass icon rail, three-column budget (Budgeted, Spent, Balance) and a category panel.
- Desktop: the redesigned sidebar on by default, shown as an inset card, budget groups in cards with outlined Budgeted and Balance pills, overspent shortcut, category inspector; register Uncleared chip, bulk toolbar and Upcoming/Posted headings.

## Capabilities
### New Capabilities
- `mobile-shell`: phone breakpoint, floating tab bar and Add button, More sheet, large-title header, safe area, toasts, bottom sheets, zoom, focus, theme contrast
- `mobile-budget`: phone budget cards, Balance pills, banners, To budget card ("Move", or "Cover" when overbudgeted), category sheet, card-debt colours
- `mobile-transactions`: Transactions screen, rows, sheet editor, splits, payee picker, iOS keyboard
- `mobile-manage`: phone accounts, reports, schedules, payees, rules, settings
- `tablet-layout`: 730–1099px glass rail, three-column budget, category panel
- `desktop-budget-register`: desktop card sidebar, card budget, inspector, register toolbar
### Modified Capabilities
- none (no specs exist under `openspec/specs/`)

## Impact
- `packages/component-library/src/{theme.ts,tokens.ts,themes/{light,dark,midnight}.css,hooks/useResponsive.ts}`: new semantic tokens (card elevation, glass, accent-subtle, four Balance pill pairs), `radius.card`/`radius.sheet`, light `pageTextLight` → navy600.
- `packages/desktop-client`: `index.html`, `components/{FinancesApp,Page,Notifications}.tsx`, `components/common/Modal.tsx`, `components/mobile/**`, `components/modals/**`, `components/budget/**`, `components/accounts/Header.tsx`, `components/transactions/TransactionsTable.tsx`, `components/sidebar/index.tsx`, `hooks/useFeatureFlag.ts`, `components/settings/**`, `components/reports/SummaryNumber.tsx`, e2e page models and most VRT snapshots.
- No server, sync, data-model or pref change (`loot-core/src/types/prefs.ts` stays as on the base). No new dependencies.
- Fork only: no upstream PR. History of `feat/responsive-redesign` is rewritten to four commits and force-pushed after Denis's go-ahead; the live `actual` container is redeployed by Denis separately.
