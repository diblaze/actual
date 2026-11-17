## Purpose
Phone management screens: accounts list, reports, schedules, payees, rules and settings, including the credit-card debt setting.

## ADDED Requirements

### Requirement: Accounts as grouped cards
The system SHALL show the phone accounts list as On budget, Off budget and Closed cards, each under a heading with the group's signed total, and each account row with an icon, name, signed balance and a chevron.

#### Scenario: Account group shows total
- **GIVEN** open on-budget accounts of 1,000.00 and −250.00
- **WHEN** the accounts list opens
- **THEN** the On budget heading shows 750.00 and both rows show their balances

### Requirement: New transactions marker
The system SHALL mark an account row with a labelled dot when bank sync brought it new transactions.

#### Scenario: Updated account shows dot
- **GIVEN** account Checking received new transactions from the last sync
- **WHEN** the accounts list renders
- **THEN** only Checking's row exposes an element labelled "New transactions"

### Requirement: Account sync badge
The system SHALL label each account row with a small pill, icon plus word: "Synced" when linked to bank sync and "Manual" otherwise, and SHALL mark a row whose last bank sync failed with a "Sync failed" icon.

#### Scenario: Linked account shows Synced
- **GIVEN** an account linked to bank sync
- **WHEN** the accounts list renders
- **THEN** its row shows a "Synced" pill

#### Scenario: Unlinked account shows Manual
- **GIVEN** an account with no bank sync
- **WHEN** the accounts list renders
- **THEN** its row shows a "Manual" pill

#### Scenario: Failed sync shows marker
- **GIVEN** account Checking whose last bank sync failed and that also received new transactions
- **WHEN** the accounts list renders
- **THEN** its row shows a marker labelled "Sync failed" as well as the "New transactions" dot

### Requirement: Report summary numbers at a fixed size
The system SHALL render phone report summary amounts at a fixed type size, independent of digit count.

#### Scenario: Long summary number keeps size
- **GIVEN** two summary cards showing 12.00 and 1,234,567.00
- **WHEN** the reports page renders on a phone
- **THEN** both amounts use the same font size

### Requirement: Overdue schedules first with actions
The system SHALL list overdue schedules first on the phone schedules page, each offering Mark paid and Skip.

#### Scenario: Overdue schedule offers Mark paid and Skip
- **GIVEN** a schedule whose next date has passed
- **WHEN** the user taps Skip on its overdue card
- **THEN** the schedule's next date moves to the following occurrence

### Requirement: Payee letter index
The system SHALL show an A–Z index beside the phone payee list that scrolls to the first payee of a letter.

#### Scenario: Letter index jumps to letter
- **GIVEN** payees starting with A through M
- **WHEN** the user taps "M" in the index
- **THEN** the first payee starting with M is at the top of the list

### Requirement: Duplicate payee suggestion
The system SHALL suggest merging payees whose names are equal ignoring case and surrounding whitespace, opening the existing merge flow.

#### Scenario: Same-name payees suggested for merge
- **GIVEN** payees "ICA Maxi" and "ica maxi "
- **WHEN** the payee list opens
- **THEN** a suggestion to merge them is shown

#### Scenario: Distinct names not suggested
- **GIVEN** payees "ICA Maxi" and "ICA Nära"
- **WHEN** the payee list opens
- **THEN** no merge suggestion is shown

### Requirement: Rules read as sentences
The system SHALL show each rule on the phone rules list as a sentence ("If payee is X, set category to Y").

#### Scenario: Rule shown as sentence
- **GIVEN** a rule with condition payee is "Spotify" and action set category "Subscriptions"
- **WHEN** the rules list renders
- **THEN** the row reads "If payee is Spotify, set category to Subscriptions"

### Requirement: Theme choice as segmented control
The system SHALL offer the theme as a segmented control on the settings page.

#### Scenario: Choosing Dark applies dark theme
- **GIVEN** the light theme
- **WHEN** the user picks Dark in the theme control
- **THEN** the app renders with the dark theme

### Requirement: Card debt toggle reachable on phone
The system SHALL keep the carry card debt toggle reachable from phone Settings whenever card payment categories are on.

#### Scenario: Toggle carry card debt on phone
- **GIVEN** card payment categories are on, on a 390px-wide phone
- **WHEN** the user opens Settings, then Experimental
- **THEN** "Carry uncovered card spending into next month" is visible and switching it on persists after reload
