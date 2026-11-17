# Proposal

Status: approved
Issue: diblaze/actual#14

## Why
Denis approved the responsive redesign (`feat/responsive-redesign`, 4 commits on 7830ebc) and wants it on the latest upstream Actual (9f046e7, 191 commits newer), looking and behaving 1:1 like it does now. Upstream has since moved theme colours into one source file, made phone menus bottom sheets, added goal progress to balance menus and rebuilt settings. A rebase would conflict in about 60 files, so the redesign is re-ported with upstream's structures as substrate only, on top of the credit-card stack, which was rebased but not yet verified.

## What Changes
- Credit-card stack (22 commits) verified on upstream 9f046e7. Its re-resolved phone menu rules, partial category updates and card-debt tooltip get tests. Fixes are folded into the stack commits.
- Phone layout applies up to 729px wide (upstream: up to 511px). Tablet layout covers 730px to 1099px.
- **BREAKING** (fork UI only) Upstream's drag-pill six-tab nav is replaced by the floating glass tab bar (Budget, Transactions, Accounts, Reports, More) and a floating "Add" button. The More sheet lists Schedules, Settings, Switch budget file and Help; Payees, Rules, Tags and Bank sync are reached through Settings. This is the one approved deviation from the old redesign.
- Phone pages get a 34px large title under round glass header buttons, rounded cards on the page background and no purple header bar.
- Every phone dialog, upstream's sheets included, opens as our bottom sheet: 24px corners, a header with title and Close, and a lift above the calculator keypad. Sheets are named by their title. Long-list pickers fill the screen. Pinch zoom is allowed and touch inputs are at least 16px.
- Phone budget gets group cards with Budgeted and Balance totals, Balance pills coloured by state, a To budget card, Overspent and Uncategorized banners, and our category sheet (Balance, Budgeted, Spent, spent bar, Cover/Move, recent transactions).
- Card debt colours stay: carried debt is red, this month's uncovered card spending and unfunded payments are warning.
- Phone transactions get a Transactions tab, category chips, an Upcoming section with day totals, and an editor that opens as a sheet over the previous screen with Expense/Income/Transfer and one full-width "Add transaction" button.
- Phone manage screens get grouped account cards, Synced/Manual pills, a new-transactions dot, fixed-size report numbers, overdue schedule actions, a payee letter index and merge suggestion, rules as sentences, settings in our cards and a theme segmented control.
- Tablet gets a glass icon rail, a three-column budget and a category panel.
- Desktop turns the redesigned sidebar on by default, inside an inset card. The budget shows group cards, outlined Budgeted, a Balance pill, an Overspent shortcut and a category inspector. The register gets an Uncleared chip, a bulk toolbar and Upcoming/Posted headings.
- Upstream additions are kept, drawn in our design language: the goal ring in Balance pills; goal status, progress and "Fund goal from To Budget" in the category sheet, tablet panel, desktop inspector and desktop balance menu; the sheet drag handle, slide/fade and swipe-to-dismiss; and "Hide reconciled" on the Transactions screen. Upstream's menu sheet contents, settings sections and desktop sidebar items stay.
- Parity with 901d6cb is proven by screenshot comparison of the key screens.

## Capabilities
### New Capabilities
- `credit-card-payments`: payment-category rules that the rebase re-resolved (phone menus, partial updates, card-debt tooltip)
- `mobile-shell`: phone breakpoint, tab bar, Add button, More sheet, Settings route to management pages, header, toasts, sheets, keypad, zoom, focus, contrast
- `mobile-budget`: phone budget cards, Balance pills, banners, To budget card, category sheet, card-debt colours
- `mobile-transactions`: Transactions screen, rows, sheet editor, splits, payee picker, iOS keyboard
- `mobile-manage`: phone accounts, reports, schedules, payees, rules, settings
- `tablet-layout`: 730–1099px glass rail, three-column budget, category panel
- `desktop-budget-register`: desktop card sidebar, card budget, inspector, register toolbar
- `redesign-parity`: key screens match the approved redesign build
### Modified Capabilities
- none (`openspec/specs/` is empty on this branch)

## Impact
- `packages/component-library/src/themes/source/colors.ts`, `tokens.ts` (`radius.card`, `radius.sheet` 24), `hooks/useResponsive.ts`, and a contrast test next to `themes/source/generate.web.test.ts`.
- `packages/desktop-client`: `index.html`, `FinancesApp.tsx`, `Page.tsx`, `common/Modal.tsx`, `mobile/**` (including `MobileSheet.tsx`), `modals/**` (upstream balance-menu modals deleted, `CategorySheet`, `MoreModal`, summary and autocomplete sheets), `budget/**`, `accounts/Header.tsx`, `transactions/TransactionsTable.tsx`, `sidebar/**`, `settings/{Themes,SettingsGroup,SettingsNav}.tsx`, `hooks/useFeatureFlag.ts`, `reports/SummaryNumber.tsx`, e2e page models, new e2e files including `redesign-parity.test.ts`, and most VRT snapshots.
- `packages/loot-core`: tests only (credit-card stack). No new dependencies, no pref change.
- Data: the live instance gets upstream migration `1792441821604_dashboard_page_sort_order.sql`, which is one-way, so the data is copied before redeploy.
- Release: the cc-stack branches are force-pushed and PR #13's base moves. `feat/responsive-redesign-v2` is pushed. `actual-cc`/`actual-http-api-cc` are rebuilt. Each of these needs Denis's go-ahead.
