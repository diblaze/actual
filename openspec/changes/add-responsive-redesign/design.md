# Design
## Context
Base `fix/cc-reconcile-uncategorized` @ 7830ebc. Visual spec: canvas `actual-depth` (`/home/denis/personal-finance/.claude/worktrees/actual-mockup/mockups/actual-depth/project/{Main,Transactions,Accounts,TxnNew,Tablet,Desktop}.dc.html`, light and dark palettes in each `renderVals`). Its hexes are Actual palette values; components reach them only through `theme.*` (DESIGN.md:117 "A hardcoded hex in a component is a bug.").

Canvas
- E1 `Main.dc.html:68` — `<nav aria-label="Main" style="position: absolute; left: 12px; right: 12px; bottom: 24px; height: 72px; border-radius: 36px; … backdrop-filter: blur(24px);">` — floating glass bar; tabs `:97-103` Budget, Transactions, Accounts, Reports, More; active pill `:111` `bg: on ? c.navActive`.
- E2 `Main.dc.html:66` — `bottom: 112px; height: 56px; … >Add</a>` — floating Add pill; `:29-33` banner `Categories overspent` + `Fix`; `:35-41` To budget card + button labelled `Assign`; `:47-60` group heading with `Budgeted`/`Balance` totals, rows name + budgeted + pill.
- E3 `Main.dc.html:78-90` — light `bg '#e8ecf0', card '#ffffff', sub '#486581', accent '#8719e0'`, `shadowSm '0 1px 2px rgba(39,38,48,0.06)'`, pills `pos ['#c6f7e2','#0e5c49'] … zero ['#e8ecf0','#486581']`; dark `bg '#080811', card '#141520', line '#243b53'`, `shadowSm: 'none'`.
- E4 `Transactions.dc.html:20-30` — Search, Select, More glass buttons; `<h1 … font-size: 34px` ; `Uncategorized` banner with `Show`; rows `:36-51` payee, chip or `Uncategorized` chip, raw payee `{{t.raw}}`, amount + `aria-label="Cleared"`, account.
- E5 `TxnNew.dc.html:19-23` — previous screen `scale(0.92) … opacity: 0.55`, `role="dialog"` sheet `top: 64px; border-radius: 24px 24px 0 0`; `:24-33` header `background: {{c.header}}` with Cancel, title, `Amount`; `:36-40` `Expense`/`Income`/`Transfer` radiogroup; `:42-54` field card Payee/Category/Account/Date, card Notes/Cleared; `:57-59` one `Add transaction` button; header `'#9446ed'` light, `'#580a94'` dark (`:68-73`).
- E6 `Accounts.dc.html:32-45` — group heading name + total; row dot `aria-label="New transactions"`, icon, name, balance, chevron.
- E7 `Tablet.dc.html:20-26` — rail `width: 80px … border-radius: 28px`, items + `aria-label="Add transaction"` at foot; `:48-58` Budgeted/Spent/Balance; `:66-87` panel: name, Balance, Budgeted/Spent tiles, `Cover 312,40`, `Move money`, `Recent transactions`.
- E8 `Desktop.dc.html:20-39` — sidebar card nav + account groups; `:52-56` `Overspent` + `Fix`; `:70-72` outlined budgeted, balance pill; `:79-101` inspector with group, `role="img" aria-label="106 percent of budget spent"`, recent transactions.
- E9 `contrast.py:16-28` + run output — all 23 light/dark pairs ≥ 4.5 (lowest 4.82 white on `#9446ed`).

Theme
- E10 `component-library/src/themes/light.css:9-10` — `--color-pageText: #272630;` `--color-pageTextLight: var(--palette-navy500);` (#627d98, 4.1:1 on page); `palette.css:22` `--palette-navy600: #486581;`.
- E11 `component-library/src/theme.ts:10` — `pageTextLight: 'var(--color-pageTextLight)',` — tokens are a hand-kept map; each new CSS var needs a line here.
- E12 `component-library/src/tokens.ts:48-53` — `type RadiusSize = 'sm' | 'pill'; … sm: 4, pill: 999,` — theme-independent radii live here.
- E13 `light.css:104` `--color-mobileHeaderBackground: var(--palette-purple400);`, `dark.css:102` `var(--palette-purple800);` — equal to the canvas sheet header (E5).
- E14 `dark.css:192-193` — `--color-upcomingBackground: var(--palette-purple700); --color-upcomingText: var(--palette-purple100);` — the only purple tint pair, owned by schedule status.
- E15 `e2e/fixtures.ts:54-85` — `toMatchThemeScreenshots` shoots `auto`, `dark` and `midnight`.

Shell
- E16 `component-library/src/hooks/useResponsive.ts:15-17` — `isNarrowWidth` / `isMediumWidth: width >= breakpoints.medium && width < breakpoints.wide,`.
- E17 `desktop-client/src/components/mobile/MobileNavTabs.tsx:31` — `MOBILE_NAV_HEIGHT = \`calc(${TAB_HEIGHT + BAR_PADDING_TOP}px + env(safe-area-inset-bottom))\``; `:49-60` `position: 'fixed', … bottom: 0, … backgroundColor: theme.mobileNavBackground`; `:63-66` Budget, Accounts, `Add`, Reports; `:86-130` `TabletRail` on `theme.sidebarBackground`.
- E18 `FinancesApp.tsx:220` — `{isMediumWidth ? <TabletRail /> : <FloatableSidebar />}`; `:486-503` nav routes incl. `/accounts/:id`.
- E19 `Page.tsx:56-62` — `MobilePageHeader … height: HEADER_HEIGHT, backgroundColor: theme.mobileHeaderBackground`; `:81-89` `<h1 … fontSize: 17`; `:140-149` persistent slot with the same background; 27 files import `MobilePageHeader` (rg).
- E20 `common/Modal.tsx:122-124` — `alignItems: isNarrowWidth ? 'stretch' : 'center', justifyContent: isNarrowWidth ? 'flex-end' : 'center'`; `:157-163` `borderTopLeftRadius: 16`; `:96` `ReactAriaModalOverlay`.
- E21 `hooks/useNavigate.ts:28` — `previousLocation: location,` — every in-app navigation records the screen it came from.
- E22 `mobile/accounts/AccountsPage.tsx:48-49` — `// Virtual account id for the all-accounts transaction list (/accounts/all) export const ALL_ACCOUNTS_ID = 'all';`; `AccountPage.tsx:55-56` default title `t('All Accounts')`; `:74` `rightContent={<AddTransactionButton accountId={account?.id} />}`.
- E23 `mobile/transactions/iosKeyboard.ts:3-8` — tap must focus inside the gesture; `AddTransactionButton.tsx:28-31` `primeIOSKeyboard(); void navigate(to, { state: { accountId, categoryId } });`.

Budget
- E24 `budget/BalanceWithCarryover.tsx:140-147` — `(cardToPay > 0 && balanceValue >= 0) || isCardOnlyOverspent(…) ? { color: theme.warningText } : makeBalanceAmountStyle(` — the one place the balance state is decided; `:324-330` render prop passes `{ type, name, value, className }` only.
- E25 `mobile/budget/BalanceCell.tsx:102-110` — tint recomputed in the cell: `value < 0 ? isCardOnlyOverspent(…) ? theme.warningBackground : theme.errorBackground : value > 0 ? theme.noticeBackgroundLight` — misses the `cardToPay` warning of E24.
- E26 `mobile/budget/BudgetTable.tsx:57-64` — `ROW_GRID` four tracks (Category, Budgeted, Spent, Available); `:525-526` `label={t('Available')}`; `:113-163` `ToBudget` button.
- E27 `mobile/budget/BudgetPage.tsx:490-497` — `useLocalPref('mobile.budgetLayout')`; `loot-core/src/types/prefs.ts:114-115` replaced base `'mobile.showSpentColumn': boolean;`; `modals/BudgetPageMenuModal.tsx:70` reads it.
- E28 `BudgetPage.tsx:676-689` `Banners` (uncategorized, overbudgeted); `:715-777` `UncategorizedTransactionsBanner` → `navigate('/categories/uncategorized')`; `:865-1006` `CoverOverspentButton` (`useOverspentCategories`, `category-autocomplete` cover list).
- E29 `modals/CategorySheet.tsx:64,76` — `CategorySheet` and `CategorySheetBody`; tablet uses the body as its pane (`BudgetPage.tsx:659-665`).
- E30 `hooks/useCreditCardsEnabled.ts` — `useIsPaymentCategory` keys on `cat.payment_account`.

Transactions
- E31 `mobile/transactions/TransactionListItem.tsx:302-318` — category as 11px italic text, `{prettyCategory || t('Uncategorized')}`; `loot-core/src/types/models/transaction.ts:20` `imported_payee?: string;`.
- E32 `mobile/transactions/TransactionEdit.tsx:1364-1372` — full page with `MobilePageHeader`; `:1442-1480` `Money in`/`Money out`; `:1570-1582` recent payee chips; `:350-502` `Footer` with Cancel, `Save + new`, `Add {{amount}}`, `Save changes`, plus Schedule and split-remaining buttons.
- E33 `TransactionEdit.tsx:1717-1724` — Cleared `Toggle`; `:1385-1404` overflow menu with Delete.

Manage, tablet, desktop
- E34 `AccountsPage.tsx:134-151` `SyncBadge` Synced/Manual; `:387-410` `Net worth` header; `:492` `updatedAccounts` already read per list.
- E35 `sidebar/index.tsx:16,58` — `useFeatureFlag('newSidebarUI')` … `{newSidebarUIEnabled ? <SidebarRedesign /> : <Sidebar />}`; `hooks/useFeatureFlag.ts:6` `newSidebarUI: false,`; `themes/sidebar-redesign-light.css:6` white background.
- E36 `budget/envelope/EnvelopeBudgetComponents.tsx:83` `function SpentBar(`; `:157-158` `// plus six months of budgeted and spent, … export function CategoryInspector(` — a second inspector body next to E29.

History and tooling
- E37 `git log 7830ebc..455aedb` — slices 42eda08 shell, dfec3f8 budget, a37d74b transactions, ac9c5bc manage, df05e8f tablet, 5112f59 desktop; then cb3612d (shell, budget and transactions files), c53b094 (`index.html`, `shell.mobile.test.ts`, `Modal.tsx`, four `*AutocompleteModal.tsx`, `transactions-redesign.mobile.test.ts`), 0e3d9b2 (`index.html`), f5ee027 + 455aedb (`iosKeyboard.ts`, `AmountInput.tsx`, `AddTransactionButton.tsx`, `MobileNavTabs.tsx` incl. `RailLink` from df05e8f). `CategorySheet.tsx` is touched by dfec3f8, df05e8f, 5112f59 and cb3612d.
- E38 `bin/run-vrt:31` — `docker run --rm --network host … -it mcr.microsoft.com/playwright:v1.61.1-jammy … yarn vrt` — needs a TTY and a dev server at `E2E_START_URL` (`desktop-client/README.md:37-39` `HTTPS=true yarn start`).
- E39 `/home/denis/git/solo/skills/plan/scripts/verify-commits.sh` — runs a check at every commit of `<base>..HEAD` in a throwaway worktree.
- E40 `/sharedfolders/media/docker/services/actual-budget/compose.yaml:8` — `image: actual-cc:455aedb`; `actual-budget/AGENTS.md:19-20` — rebuild `actual-cc` and `actual-http-api-cc` from the same fork commit, bump both tags, recreate between ynabber runs.

## Goals / Non-Goals
**Goals:**
- Phone, tablet and desktop match the canvas in Actual's default theme colours and wording (Budgeted, Balance, To budget, Uncategorized, Add transaction, tab "Transactions").
- Credit-card behaviour unchanged: carried debt red, this month's card overspending and unfunded payment warning, carry toggle on phone (E24, E30).
- Accessibility: text ≥ 4.5:1 in light, dark and midnight; targets ≥ 44px; signed amounts; icon + word status; visible focus; zoom on; inputs ≥ 16px on touch; iOS keyboard priming kept (E23).
- The branch reads as one redesign in four commits, `feat(mobile)` (shell, budget and transactions), `feat(manage)`, `feat(tablet)`, `feat(desktop)`, each passing typecheck, lint and component tests on its own.

**Non-Goals:**
- Upstream PR — reopen when Denis proposes the redesign upstream (`[AI]` title rule, split per slice).
- Budget "Edit budget"/"Filter" header icons (E2 canvas) — Actual has no such phone actions; the left glass group holds Previous/Next month. Reopen when Denis names their actions.
- Transactions "Select" header button (E4) — long-press still starts selection. Reopen when a tap entry to selection mode is wanted.
- Collapsing large title on scroll — reopen if the 34px title costs too much list height in use.
- Single-balance budget layout and the accounts net-worth header — not in the canvas (E2, E6); group totals carry the sums. Reopen when Denis asks for either.
- Spent column on the phone — tablet and the category sheet show Spent; base pref `mobile.showSpentColumn` stays declared. Reopen when Denis wants Spent in phone rows.
- Desktop single-month budget — the canvas shows one month; Actual's month count stays the user's choice.
- Desktop register in cards — not in the canvas; reopen with a register artboard.
- Rule enable switch, accessibility toggles, Reconcile badge — no data or pref exists (rules have no enabled field; no reduced-motion pref).

## Decisions
- Breakpoints: `isNarrowWidth: width < breakpoints.medium`, size groups unchanged (E16, E12); DESIGN.md breakpoint line updated. Lost: raising `breakpoints.small`, which shifts every size table.
- Tokens: add only what no token covers, in light, dark and midnight plus `theme.ts` (E11): `cardElevation` (1px ring + light shadow; ring only in dark/midnight, E3), `floatingElevation`, `glassBackground`, `glassBorder`, `accentSubtleBackground`/`accentSubtleText` (nav pill, rail pill, banner buttons, selected row; E14 belongs to schedules), and `balance{Positive,Warning,Negative,Zero}{Background,Text}`. Radii go in `tokens.ts` as `radius.card = 22`, `radius.sheet = 24` (E12). Light `pageTextLight` moves to navy600 (E10) instead of a new secondary-text token; dark stays navy300. Sheet header reuses `mobileHeaderBackground`/`mobileHeaderText` (E13). Midnight reuses the dark pill pairs and takes glass from gray700. Values not in `palette.css` are written as literals in the theme files, as `light.css:9` already does.
- Contrast proof lives in the repo: `packages/component-library/src/themes/contrast.web.test.ts` resolves `var()` chains from the three theme files and asserts every text/background pair the specs name ≥ 4.5 (E9 pairs + midnight). Lost: trusting `contrast.py`, which covers two themes and lives outside the repo.
- Header: `MobilePageHeader` becomes the round glass button row plus a 34px left-aligned `h1`, transparent on `pageBackground`; the slot loses its purple fill (E19). One change covers all 27 callers. Budget passes its own header node (month title with Previous/Next in the glass group) through `Page`'s `header` prop. Lost: a `variant` prop with one caller.
- Tab bar: `MobileNavTabs` renders the floating inset glass bar (E1) with Budget `/budget`, Transactions `/accounts/all` (E22), Accounts `/accounts` (current also on `/accounts/<id>`, not on `/all`), Reports, More; and the floating Add button on `/budget` and `/accounts/:id`, priming the iOS keyboard (E23) and passing the route's account id. `AccountPage`'s header Add button goes (E22). `MOBILE_NAV_HEIGHT` becomes the clearance for bar + Add + safe area, so the existing importers keep one constant (E17).
- Balance state has one owner: `BalanceWithCarryover` adds `status: 'positive' | 'warning' | 'negative' | 'zero'` to its render-prop args, decided next to its colour rule (E24, goal underfunded → warning). `BalanceCell`, the tablet rows and the desktop pills map status to the `balance*` tokens; the cell's own tint logic (E25) is deleted. Fixes the unfunded-payment tint mismatch. Lost: recomputing in each cell.
- Phone budget: `ROW_GRID` drops to Category | Budgeted | Balance on the phone and keeps Spent at tablet width (E26); group cards carry the totals in their heading; "Available" becomes "Balance". `mobile.budgetLayout` and its menu entry go, so `prefs.ts` returns to the base (E27).
- Banners: one `ActionBanner` (count badge, label, soft action button) in `components/mobile/ActionBanner.tsx`; the overspent banner wraps `CoverOverspentButton`'s open handler (E28), the Uncategorized banner the existing query and route; the overbudgeted case moves into the To budget card's label (Overbudgeted) and button ("Cover", the existing cover-overbudgeted flow). Otherwise the button reads "Move" and opens the existing summary menu, whose first action is "Move to a category" (E26 `onPress`); the canvas' "Assign" (E2) is not Actual wording.
- Category details: `CategorySheetBody` (E29) is the only body — phone sheet, tablet panel and desktop inspector — gaining the spent bar and the four latest transactions of the month (query as in `CategoryTransactions.tsx`). Desktop `CategoryInspector` and row `SpentBar` (E36) are deleted; desktop renders the body inside the month's `SheetNameProvider`. Lost: two inspector bodies.
- Transaction editor sheet: in `FinancesApp`, when narrow and the path is `/transactions/:id` with a `previousLocation` (E21), the main `Routes` render at `previousLocation` and `TransactionEdit` renders above them inside react-aria `ModalOverlay`/`Modal`/`Dialog` (already used by E20), dimmed behind; without one (deep link) it renders over the page background. Every `navigate('/transactions/…')` caller (seven pages, rg, all importing `#hooks/useNavigate`) and `AddTransactionButton` route through `useNavigate`, so no caller changes. `TransactionEdit` drops `Page`/`MobilePageHeader` (E32) for its own purple header (Cancel, title, overflow menu, Amount), the Expense/Income/Transfer radiogroup replaces Money out/in (Transfer opens the payee picker with transfer payees only), field cards follow E5, recent payee chips (from `commonPayees`, E32) sit under the Payee row in the category-chip style, and the footer keeps Schedule and split-remaining above the full-width primary button, with "Save + new" as a secondary button beside it on new transactions. Lost: route-less modal via the modal stack (breaks URLs, back button and e2e).
- Transaction rows: card rows with a category chip (`pillBackground`/`pillText`), an Uncategorized chip (`balanceWarning*` + icon), `imported_payee` second line when different (E31), signed amount and cleared icon; account name only on `/accounts/all`.
- Accounts: groups stay On budget / Off budget / Closed (Actual's grouping, not the canvas' Cash/Credit), as cards with totals; icon tint purple for card accounts (an account a payment category points at, E30), green otherwise; the sync dot becomes the labelled "New transactions" dot from `updatedAccounts` (E34); `SyncBadge` stays as a small pill (icon + Synced/Manual) under the name. The net-worth header goes.
- Tablet: `TabletRail` becomes the inset glass rail with the five phone destinations (labels at 11px, "Transactions" in full) and the round Add at its foot (E7, E17); Schedules, Payees, Rules and Settings move into More. Rows show three amounts; the panel is `CategorySheetBody`.
- Desktop: `newSidebarUI` defaults to on in the fork (`useFeatureFlag.ts:6`, E35), so the canvas sidebar is what users see; the classic sidebar stays behind the toggle. The card frame (inset, `radius.card`, `cardElevation`) wraps whichever sidebar `FloatableSidebar` renders. Desktop page models keep working because the redesigned sidebar carries the same `budget-name` and `sidebar-*-balance` test ids (`redesign/SidebarBudgetName.tsx:69`, `redesign/AccountsSection.tsx`). Budget group cards, outlined Budgeted field, Balance pill from status, and an "N Overspent → Fix" card next to the month's To budget. Register chip, bulk toolbar and Upcoming/Posted stay as built.
- History: the commits are built from the final tree. Each file lands at its final content in the earliest commit that touches it (E37), so no commit carries an intermediate state. Shell, budget and transactions share one commit because their final code is interdependent (`Modals.tsx` registers `CategorySheet`, the tab bar primes `iosKeyboard`, the account lists use the budget card style). Guards: `git diff --exit-code <previous tip> HEAD` and `verify-commits.sh` (E39). Lost: a separate commit each for shell, budget and transactions.
- VRT: one pass on the final tree in the Playwright 1.61.1 container (E38); each test file's snapshot folder goes into the commit that owns the test file. Lost: snapshots per intermediate commit (no check runs VRT per commit).

## Risks / Trade-offs
- Files that later slices extend land early at their final content, so the first commit is large; review it by area (shell, budget, transactions).
- Rewritten history needs a force-push; the backup ref `backup/responsive-redesign-455aedb` stays local until Denis confirms the push.
- Rendering the previous screen under the sheet keeps it mounted and subscribed; its header portal and the sheet's own header must not both target the header slot. The iOS keyboard priming depends on focus moving from the proxy to the amount input inside a react-aria `Dialog` (FocusScope); only a real iPhone proves it.
- `backdrop-filter` on the fixed bar and rail costs paint time on low-end phones; the glass colour is 82–88% opaque, so text stays readable where blur is unsupported.
- Light `pageTextLight` → navy600 darkens secondary text on every desktop screen too; all VRT baselines move.
- The VRT pass runs the full suite once; `bin/run-vrt` needs `-it`, so the pass calls `docker run` without `-it`.
- `newSidebarUI` on by default moves every desktop snapshot and any e2e path that relies on classic-sidebar markup.

## Open Questions
None.
