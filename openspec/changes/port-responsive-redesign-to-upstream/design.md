# Design
## Context
Worktree `/home/denis/git/actual/feat/responsive-redesign-v2`, branch `feat/responsive-redesign-v2` @ 25538d4: upstream 9f046e7 plus the 22 rebased credit-card commits. Paths are under `packages/desktop-client/src/` unless they start with `packages/`, `e2e/` or `/`. "Old" means branch `feat/responsive-redesign` (901d6cb on 7830ebc) and its change `openspec/changes/add-responsive-redesign/`.

Contract and history
- E1 old `add-responsive-redesign/specs/*/spec.md`: 6 capabilities, carried here unchanged except for the More sheet. Old `design.md:66-75` holds Non-Goals that still apply.
- E2 canvas `mockups/actual-depth/project/TxnNew.dc.html:23`: `border-radius: 24px 24px 0 0`. `Main.dc.html:68`: `aria-label="Main"` (floating glass bar). The old `design.md:6-14` lists the rest of the canvas evidence.
- E3 overlap from `git diff --numstat 7830ebc 901d6cb` against `0728f1a 9f046e7` (0728f1a is the merge-base): 57 files changed on both sides, for example `TransactionEdit.tsx fork+944-520 up+81-15`, `common/Modal.tsx fork+76-16 up+131-16`, `MobileNavTabs.tsx fork+290-253 up+13-37`, `themes/light.css fork+18-2 up+0-272` (deleted). `modals/EnvelopeBalanceMenuModal.tsx fork+0-110 up+26-84`: the fork deleted it, upstream rewrote it.
- E4 `git log 9f046e7..25538d4`: 22 commits. PR #13 (gh) has `baseRefName feat/cc-payment-categories`, `baseRefOid 8eda63d…`, `headRefName fix/cc-reconcile-uncategorized` and `headRefOid 7830ebc…`. In the rebased stack these match cb315e7 (`fix(import): card inflow rows not uncategorized`) and 25538d4 (`fix(cc): mark card reconciliation adjustments`). The local `feat/cc-payment-categories` is at a6f747f, behind origin.

Theme
- E5 `packages/component-library/src/theme.ts:5-10`: `export const theme = Object.fromEntries(Object.entries<TokenDefinition>(colors).map(…` builds the token map from `colors.ts`, so there is no hand-kept list any more.
- E6 `themes/source/colors.ts:31`: `pageTextLight: { light: 'navy500', dark: 'navy300', midnight: 'gray200' },`. `:310`: `mobileViewTheme: { all: { ref: 'mobileHeaderBackground' } },`. `:357`: `midnight: 'purple300',` (buttonPrimaryBackground). `:719`: `} satisfies Record<string, TokenDefinition>;`.
- E7 `themes/source/types.ts:7`: `TokenValue = PaletteName | { ref: string } | { raw: string };`. Non-palette literals are written as `raw`.
- E8 `themes/index.ts:5-8`: `export const lightThemeCss = generateThemeCss('light', colors, palette);` and the same for dark, midnight and `paletteCss`. These generated strings replace the deleted `.css` files.
- E9 `packages/component-library/src/tokens.ts:48-52`: `type RadiusSize = 'sm' | 'sheet' | 'pill'; … sheet: 18,`.

Shell
- E10 `packages/component-library/src/hooks/useResponsive.ts:15`: `isNarrowWidth: width < breakpoints.small,`.
- E11 `components/common/Modal.tsx:121`: `const isSheet = presentation === 'sheet' && isNarrowWidth;`. `:229`: `aria-label={ariaLabelledBy ? undefined : t('Modal dialog')}`. `:262`: `{isSheet && <View style={mobileSheetHandleStyle} />}`. `:167-173`: `useSwipeToDismiss`. `:63-77`: slide and fade keyframes. Only `MobileSheet` passes `presentation` (rg).
- E12 `components/mobile/MobileSheet.tsx:106-119`: when not narrow it renders `Modal` + `ModalHeader` + `ModalTitle` + `ModalCloseButton`. `:122-191`: the narrow branch uses its own centred 18px `h2` title, with no close button.
- E13 `components/mobile/MobileNavTabs.tsx:33`: `MOBILE_NAV_HEIGHT = ROW_HEIGHT + PILL_HEIGHT`. `:90-96`: the nav resets on every route change (#9434). `:98-134`: tabs Budget, `Transaction` `/transactions/new`, Accounts, Reports, Schedules, Settings.
- E14 `components/FinancesApp.tsx:227`: `<FloatableSidebar />`. `:596-606`: MobileNavTabs routes, including `/settings/*`.
- E15 `components/sidebar/sidebarMenu.ts:18-24`: `SETTINGS_SECTION_IDS = ['schedules','payees','tags','rules','bank-sync']`. `:57-62`: `getSidebarMenuItemPath` gives `/settings/${id}`. `settings/SettingsNav.tsx:27-34`: the narrow list is filtered by `isItemAvailable`. `SettingsNav.test.tsx:92`: 'hides bank sync without a server'. `e2e/page-models/mobile-navigation.ts:172-208`: `goToPayeesPage`, `goToTagsPage`, `goToRulesPage` and `goToBankSyncPage` go through `settingsPage.goToSection(…)`.
- E16 `components/Page.tsx:69`: `backgroundColor: theme.mobileHeaderBackground,`. `:95`: `fontSize: 17,`. `:155`: the slot has the same purple.
- E17 `index.html:7`: `maximum-scale=1, user-scalable=no`.
- E18 `components/mobile/budget/BudgetMenuSheet.tsx:63-65`: `paddingBottom: isCalculatorOpen ? CALCULATOR_KEYBOARD_HEIGHT : 0`. `modals/AccountReconcileModal.tsx:73-74`: `paddingBottom: '30vh'`. Old 901d6cb `CalculatorKeyboard.tsx` sets `--calculator-keyboard-height` while open, and old `Modal.tsx` pads narrow sheets by it.
- E19 `hooks/useNavigate.ts:28`: `previousLocation: location,`.
- E20 `e2e/page-models/settings-page.ts:45`: `const isNarrow = viewport != null && viewport.width < 512;`.

Budget
- E21 `components/budget/BalanceWithCarryover.tsx:58-68`: children get `(props & { className }, ringProgress)`. `:145-158`: the single colour rule, with the card warning first. `:207-253`: the card-debt Tooltip only when `creditDebt > 0 || cardToPay > 0`.
- E22 `components/mobile/budget/BalanceCell.tsx:100-104`: `AutoTextSize … minFontSizePx={6} maxFontSizePx={12}`. `:141-143`: `<GoalProgressRing>` inside the pill button (upstream-only).
- E23 `components/modals/EnvelopeBalanceMenuModal.tsx:38-49`: `MobileSheet` + `MobileSheetBalanceHeader` (goal status and bar) + `MobileSheetMenuRows` from `useBalanceMenu`. `budget/envelope/BalanceMenu.tsx:93-96`: `fund-goal` item. Tests asserting these: `EnvelopeBalanceMenuModal.test.tsx:95`, `BalanceWithCarryover.test.tsx:249-250`, `mobile/budget/ExpenseCategoryListItem.test.tsx:74`. `git show -s 6ef6d30`: "the desktop hover tooltip is removed".
- E24 old `Modals.tsx` diff: `-<EnvelopeBalanceMenuModal {...modal.options} />` `+<CategorySheet name="envelope-balance-menu" {...modal.options} />` (tracking too). Old `modalsSlice.ts` adds `onShowActivity`, `onEditCategory`, `onBudgetAction`. Old `CategorySheet.tsx:74-80` is `Modal` + `CategorySheetBody`.
- E25 `components/modals/EnvelopeBudgetSummaryModal.tsx:131`: `<MobileSheet name="envelope-budget-summary" …>`. `:149-152`: `ToBudgetSheetActions`. Old 901d6cb's version is `Modal` + `ModalHeader` and uses `useToBudgetActions` from the new `budget/envelope/useEnvelopeBudgetActions.ts`. `budget/envelope/budgetsummary/ToBudgetMenu.tsx:40-73`: the same five items as before (`transfer`, `buffer`, `cover`, `disable-auto-buffer`, `reset-buffer`).
- E26 `components/mobile/budget/BudgetPage.tsx:615-631`: `Banners` with `UncategorizedTransactionsBanner` and `OverbudgetedBanner`.

Transactions
- E27 `components/mobile/accounts/AccountPage.tsx:68`: `accountIdParam === 'all' ? (` renders `AllAccountTransactions` (`AllAccountTransactions.tsx:34`). `:51-58`: `hide-reconciled-all` filter (#9257, upstream-only).
- E28 upstream `TransactionEdit.tsx` hunks (0728f1a..9f046e7) sit in `TransactionEditUnconnected`: `transactionForRulesFromList`, `learn-categories`, split-rule propagation. The fork's +944-520 is mostly `TransactionEditInner`/`Footer` UI (E3).
- E29 `components/mobile/transactions/iosKeyboard.ts` does not exist upstream (ls). Old 901d6cb adds it and its test.

Manage, desktop, deploy
- E30 `components/settings/SettingsGroup.tsx:38-47`: an upstream card with `settingsCardBackground`, a 1px border and radius 6. Old 901d6cb `settings/UI.tsx` `Setting` on narrow: `backgroundColor: theme.cardBackground, borderRadius: radius.card, border: 'none', boxShadow: theme.cardElevation`. `git show -s 0d29233` (#9110): "move payees, rules and bank sync into a settings menu on mobile", "remove payees, rules, bank sync and tags from the redesigned sidebar".
- E31 `components/settings/Themes.tsx:231`: `<Select<string>` theme picker in a `SettingsRow`.
- E32 `components/settings/Experimental.tsx:234`: `flag="ccCarryCardDebt"`. `:247`: `Subfeature: Carry uncovered card spending into next month`.
- E33 `hooks/useFeatureFlag.ts:6`: `newSidebarUI: false,`. `sidebar/index.tsx:61`: `{newSidebarUIEnabled ? <SidebarRedesign /> : <Sidebar />}`.
- E34 `components/modals/CategoryMenuModal.tsx:50-53`: "A credit card's payment category … cannot be deleted. One left hidden … can still be shown". `packages/loot-core/src/server/budget/app.ts:358-360`: partial update comment (#8857). `:377-388`: payment category forced to the card name and `hidden: !!card.closed`. No unit test covers either.
- E35 migrations: the stack (`9f046e7..25538d4`) adds `1791663227985_add_category_payment_account.sql`, which live already has via 901d6cb. Upstream (`0728f1a..9f046e7`) adds `1792441821604_dashboard_page_sort_order.sql`, which is new to live and one-way.
- E36 `/sharedfolders/media/docker/services/actual-budget/compose.yaml:8`: `image: actual-cc:901d6cb`. `:29`: `actual-http-api-cc:901d6cb`. `actual-budget/AGENTS.md:19-20`: build both from the same fork commit, bump both tags, recreate between ynabber runs.
- E37 `bin/run-vrt:31`: `docker run … -it mcr.microsoft.com/playwright:v1.61.1-jammy` (needs a TTY). `/home/denis/git/solo/skills/plan/scripts/verify-commits.sh`: runs a check at every commit of `<base>..HEAD` in a throwaway worktree.

## Goals / Non-Goals
**Goals:**
- What the user sees and does is 1:1 with 901d6cb, its specs (E1) and the canvas (E2) in light, dark and midnight. Upstream's new structures (`colors.ts`, `MobileSheet`, `SettingsGroup`, balance-menu modals, goal ring) are only the substrate.
- The approved layout deviation is the More sheet (Schedules, Settings, Switch budget file, Help).
- Upstream additions Denis approved are shown in our design language: goal ring, goal status and fund-goal, the desktop balance-menu goal block, "Hide reconciled", sheet handle, motion and swipe. They are listed as parity exceptions.
- The credit-card stack is verified, and its fixes are folded into the stack commits.
- History is the stack followed by four redesign commits, `feat(mobile)`, `feat(manage)`, `feat(tablet)`, `feat(desktop)`, each passing **Check** on its own. Parity with 901d6cb is proven by screenshot comparison.

**Non-Goals:**
- Old Non-Goals (old `design.md:66-75`) stand. Reopen each on its own trigger there.
- Fork drag pill, hide-on-scroll and upstream's nav reset on route change (#9434, E13): the floating bar never hides, so dropping the reset is invisible. Reopen if the bar hides again.
- Rewording the `[AI]`-prefixed commits in the cc stack. Reopen if Denis wants uniform fork history.
- Deleting `origin/feat/responsive-redesign` after v2 is pushed. Reopen when Denis retires the old branch.

## Decisions
- **Port mechanics per file** (E3). (a) Files new in 901d6cb are copied, then adapted. (b) Files only the fork changed get `git diff 7830ebc 901d6cb -- <f> | git apply -3`. (c) Where both sides changed and upstream's change is small next to the fork's (`TransactionEdit`, `mobile/budget/{BudgetPage,ExpenseCategoryListItem,ExpenseCategoryList,IncomeCategoryListItem}`, `budget/BudgetCategories`, `mobile/transactions/TransactionList`, `modals/PayeeAutocompleteModal`), the 901d6cb file is taken and `git diff 0728f1a 9f046e7 -- <f> | git apply -3` is replayed on it. (d) Where upstream rebuilt the file (`common/Modal`, `mobile/MobileSheet`, `FinancesApp`, `Page`, `BalanceWithCarryover`, `BalanceCell`, `mobile/accounts/AccountPage`, `settings/{Themes,SettingsGroup,SettingsNav}`, `budget/index`, `transactions/TransactionsTable`, `mobile/transactions/FocusableAmountInput`, mobile page models), the fork's intent is re-applied by hand on upstream's version, until it renders as 901d6cb. The parity check decides. Lost: a rebase of 901d6cb, which would conflict in about 57 files.
- **Tokens** go into `colors.ts` with light/dark/midnight values (E5–E7): `cardElevation`, `floatingElevation`, `glassBackground`, `glassBorder`, `accentSubtleBackground`/`Text` and `balance{Positive,Warning,Negative,Zero}{Background,Text}`, with the same values as old `themes/*.css`. Other values change in place: light `pageTextLight` → `navy600`, `mobileViewTheme` → `{ ref: 'pageBackground' }`, midnight `buttonPrimaryBackground` → `purple400` (E6). In `tokens.ts`, `radius.card = 22` is added and `radius.sheet` goes to 24, matching the canvas (E2, E9). Every sheet, upstream's included, gets 24px corners.
- **Contrast test** reads `paletteCss` + `{light,dark,midnight}ThemeCss` from `themes/index.ts` (E8) in place of the deleted files. The old resolver is unchanged.
- **Breakpoint** stays as old: `isNarrowWidth: width < breakpoints.medium` (E10), with `WideNotSupported`/`NarrowAlternate` on `isWideWidth`. `settings-page.ts:45` goes to 730 (E20).
- **Sheets use our look with upstream's motion.** On narrow, `Modal` renders 901d6cb's sheet: stretched to the bottom, `pageBackground` surface, `radius.sheet` top corners, safe-area padding, the keypad lift and a title-named dialog. On top of that it adds upstream's drag handle, slide-in/out and backdrop-fade keyframes, the reduced-motion fallback and `useSwipeToDismiss` (E11). `presentation` goes. `MobileSheet`'s narrow branch renders the same `ModalHeader` + `ModalTitle` + `ModalCloseButton` as its wide branch (E12), so every upstream sheet gets our header, close button and corners. `fullScreenOnNarrow` comes back for the four autocomplete pickers.
- **Keypad lift is ours**: `CalculatorKeyboard` publishes `--calculator-keyboard-height` while open, and narrow `Modal` pads by it (E18, 901d6cb). `BudgetMenuSheet`'s `wrapperStyle` padding and `AccountReconcileModal`'s `30vh` are removed.
- **Tab bar**: `MobileNavTabs` becomes the old floating bar and Add. More is current on `/schedules` and `/settings/*`.
- **More sheet follows upstream's navigation, the one approved deviation**: the More sheet (our chrome) lists only Schedules, Settings, Switch budget file and Help. Payees, Rules, Tags and Bank sync are reached through upstream's Settings navigation (`/settings/<id>`, filtered by `isItemAvailable`; E15). The e2e page models keep upstream's Settings-based `goTo*Page` methods. Lost: one-tap tiles for those four pages, which would duplicate Settings' own list.
- **Phone menu sheet contents are upstream's**: the category, category group, account, budget amount, budget month and schedule menus keep upstream's #9127 rows, in-sheet delete confirm and notes rows inside our sheet chrome. The re-resolved cc rules live in them.
- **Settings are upstream's sections in our cards**: upstream's section pages (General, Payees, Tags, Rules, Bank sync, Advanced, Experimental, with API keys and sidebar menu items) stay. Narrow `SettingsGroup` and the narrow `SettingsNav` list take 901d6cb's card style (`cardBackground`, `radius.card`, no border, `cardElevation`; E30).
- **Desktop sidebar items are upstream's**: the redesigned sidebar does not list Payees, Rules, Tags or Bank sync by default, and they can be re-added via sidebar settings (E30, #9110).
- **Balance state has one owner** (E21): `BalanceWithCarryover` adds `status` to the children's first argument next to its existing colour rule. `BalanceCell` maps `status` to the `balance*` pill tokens and uses a fixed size of at least 12px, as in 901d6cb. It draws `GoalProgressRing` inside our pill from `ringProgress` and keeps the goal status in the accessible name (E22). The tablet rows get it the same way.
- **Category sheet is ours** (E24): both balance-menu names route to 901d6cb's `CategorySheet` (`Modal` + `CategorySheetBody`) in `Modals.tsx`, with the old `modalsSlice` option fields. Upstream's `EnvelopeBalanceMenuModal`/`TrackingBalanceMenuModal` are deleted, as 901d6cb deleted them. `CategorySheetBody` gains a goal card in our style: upstream's `GoalStatus` with its progress bar and a "Fund goal from To Budget" button. It is wired to the same `onFundGoal` and the fund amount that `useBalanceMenu` computes (E23), so it is shown on the phone sheet, tablet panel and desktop inspector. Upstream's balance-menu goal tests move to `CategorySheet.test.tsx`, and the goal-funding test in `ExpenseCategoryListItem.test.tsx` targets the sheet. Lost: hosting our body in upstream's modal, which would render upstream's sheet header, goal block and rows (E23), so it would not be 1:1.
- **To budget is ours**: `EnvelopeBudgetSummaryModal` is 901d6cb's version (`Modal` + `ModalHeader`, `useToBudgetActions`), with the flows rebased on upstream's current transfer and cover code (E25). "Move" opens it as before.
- **Desktop balance menu is upstream's**: the goal status block at the top and the "Fund goal from To Budget" item stay (E23). The desktop goal hover tooltip stays removed, as upstream removed it.
- **"Hide reconciled" stays**: the all-accounts menu sheet keeps upstream's toggle (E27), drawn as a row in our sheet.
- **Transaction editor sheet**: as old. `FinancesApp` renders the main routes at `previousLocation` (E19) and the editor in a react-aria overlay with 24px corners. `/accounts/all` stays `AllAccountTransactions` (E27). Upstream's logic hunks replay onto the fork's file (E28). `iosKeyboard.ts` is copied (E29).
- **Settings theme control**: the old segmented control replaces the `Select` inside the existing `SettingsRow` (E31). The card-debt toggle stays where the stack put it (E32).
- **Desktop**: `newSidebarUI: true` (E33), the card frame around `FloatableSidebar`, budget cards, inspector and register as old.
- **Credit-card stack verification**: the four rules re-resolved without tests (E34, E21) get unit tests. Failures are fixed as `--fixup` of the stack commit that introduced the line, then `git rebase --autosquash 9f046e7`. PR #13's branches move to the rebased commits with the same subjects (E4).
- **Parity check**: a new `e2e/redesign-parity.test.ts` shoots the key screens: phone budget, category sheet, Transactions, editor sheet, accounts, settings, tablet budget and desktop budget, each at fixed viewports in light and dark on the demo budget. Its baselines are generated on 901d6cb in a temporary detached worktree, then compared on v2 without `--update-snapshots`. Parity shots run with default flags, so goal UI only shows in its own tests. A diff passes only for an approved exception: the More sheet, the sheet drag handle, the goal ring, goal status and fund-goal (goal templates on), or the "Hide reconciled" row. After that, the test keeps v2's baselines as a regression guard. Lost: eyeballing VRT alone, which cannot prove "1:1".
- **History**: one commit per group on top of the stack. Later fixes use `--fixup` + `git rebase --autosquash <stack tip>`. If autosquash conflicts, the branch is rebuilt from the final tree instead (each file at its final content in the earliest commit that touches it), guarded by `git diff --exit-code <pre-rebuild tip> HEAD`.
- **VRT**: one pass on the final tree after parity (E37, no `-it`). Snapshot folders go to the commit that owns their test file. Upstream-owned `*.mobile.test.ts` folders go to `feat(mobile)`, `tablet.test.ts` to `feat(tablet)`, and other desktop folders and `redesign-parity` to `feat(desktop)`. `credit-card-payments.test.ts-snapshots` is regenerated at the stack tip and folded into the stack's VRT snapshot commit first.

## Risks / Trade-offs
- Deleting upstream's balance-menu modals and redrawing goal UI and sheets in our style widens the fork's divergence. Each future upstream sync conflicts in `Modal`, `MobileSheet`, `BalanceCell` and `CategorySheet`.
- The agent's 10 conflict resolutions in the stack are unverified, and a wrong one can hide in an untested branch. That is why group 1 adds tests before any redesign work.
- Making every narrow `Modal` a sheet changes upstream dialogs that were centred (confirmations, reconcile). The parity check and VRT review must cover them.
- Upstream changed the demo data or the menu sheet contents (#9127) in places that differ from 901d6cb. Parity diffs there need Denis's call before they are accepted.
- Custom catalog themes do not define the new tokens and inherit light/dark values. The contrast test covers built-ins only.
- The upstream migration is one-way. The live data copy must exist before the new image starts (E35, E36).
- The previous screen stays mounted under the editor sheet. iOS keyboard priming inside a react-aria Dialog is only proven on a real iPhone.

## Open Questions
None.
