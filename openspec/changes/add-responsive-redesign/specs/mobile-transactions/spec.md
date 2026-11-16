## Purpose
Phone transaction screens: the Transactions screen and account registers, the transaction editor sheet, splits, the payee picker and the iOS keyboard.

## ADDED Requirements

### Requirement: Transactions screen
The system SHALL open, from the Transactions tab, the register of all accounts under the large title "Transactions", showing each row's account name.

#### Scenario: Transactions tab lists all accounts
- **GIVEN** transactions in accounts Checking and Visa card
- **WHEN** the user taps the Transactions tab
- **THEN** a "Transactions" heading shows both accounts' transactions, each row naming its account

### Requirement: Uncategorized banner on transactions
The system SHALL show on the Transactions screen, when uncategorized transactions exist, a banner "N Uncategorized" with a Show button that opens the uncategorized transactions list.

#### Scenario: Transactions screen shows uncategorized banner
- **GIVEN** one uncategorized transaction
- **WHEN** the user taps Show on the Transactions screen's banner reading "1 Uncategorized"
- **THEN** the uncategorized transactions list opens

### Requirement: Transaction rows with category chip
The system SHALL show each transaction row with payee, a category chip or an "Uncategorized" chip, the imported payee text as a second line when it differs from the payee, and the signed amount.

#### Scenario: Row shows category chip and imported payee
- **GIVEN** a transaction to payee "Corner Market" in Groceries, imported as "CORNER MARKET 104", of −412.35
- **WHEN** the register renders
- **THEN** the row shows "Corner Market", a "Groceries" chip, "CORNER MARKET 104" and "−412.35"

#### Scenario: Uncategorized row shows chip
- **GIVEN** an on-budget transaction with no category
- **WHEN** the register renders
- **THEN** its row shows an "Uncategorized" chip with an icon

### Requirement: Upcoming transactions section
The system SHALL list scheduled transactions under an Upcoming heading above posted ones, each with a status badge of icon plus word (Due, Overdue, Upcoming).

#### Scenario: Upcoming section shows status words
- **GIVEN** an account with one overdue and one future scheduled transaction
- **WHEN** its register opens on a phone
- **THEN** both appear under "Upcoming" with badges reading "Overdue" and "Upcoming"

### Requirement: Posted transactions grouped by day with totals
The system SHALL group posted transactions under a heading per day showing that day's signed net total.

#### Scenario: Day header shows total
- **GIVEN** two transactions on one day of −23.50 and −10.00
- **WHEN** the register renders
- **THEN** that day's heading shows −33.50

### Requirement: Cleared status labelled
The system SHALL mark cleared transactions with an icon that has an accessible "Cleared" label.

#### Scenario: Cleared transaction labelled
- **GIVEN** a cleared and an uncleared transaction
- **WHEN** the register renders
- **THEN** only the cleared row exposes an element labelled "Cleared"

### Requirement: Transaction editor as a bottom sheet
The system SHALL open the new and edit transaction screens as a bottom sheet over the dimmed previous screen, with a purple header holding Cancel, the title and the amount; Cancel closes the sheet without saving.

#### Scenario: New transaction opens as sheet
- **GIVEN** the phone budget page
- **WHEN** the user taps Add
- **THEN** a dialog named "New Transaction" opens with an "Amount" field in its header, and the budget page stays rendered behind it

#### Scenario: Cancel discards edits
- **GIVEN** a transaction whose notes the user changed
- **WHEN** the user taps Cancel
- **THEN** the register shows the transaction with its original notes

#### Scenario: Deep link shows the editor alone
- **GIVEN** no screen open before it
- **WHEN** the user opens /transactions/new directly
- **THEN** the editor fills the page from the top and no previous screen renders behind it

#### Scenario: Escape closes the sheet
- **GIVEN** a transaction open as a sheet over its register
- **WHEN** the user presses Escape
- **THEN** the sheet closes and the register is shown again

### Requirement: Expense, Income or Transfer
The system SHALL offer Expense, Income and Transfer below the sheet header; Expense saves a negative amount, Income a positive amount, and Transfer limits the payee choice to accounts.

#### Scenario: Income makes amount positive
- **GIVEN** a transaction of −23.50 open for editing
- **WHEN** the user picks Income and saves
- **THEN** the saved amount is 23.50

#### Scenario: Transfer picks an account
- **GIVEN** a new transaction and an account named Savings
- **WHEN** the user picks Transfer and opens the payee field
- **THEN** the picker lists accounts including Savings and no regular payees

#### Scenario: Cancelling Transfer keeps the type
- **GIVEN** a new expense
- **WHEN** the user picks Transfer and closes the account picker without choosing
- **THEN** Expense is selected again

### Requirement: Grouped transaction fields
The system SHALL show Payee, Category, Account and Date as labelled rows in one card, and Notes and Cleared in a second card.

#### Scenario: Fields grouped in cards
- **GIVEN** a new transaction sheet
- **WHEN** it renders
- **THEN** Payee, Category, Account and Date share one card and Notes and Cleared share another, each row at least 44px tall

### Requirement: One full-width save button
The system SHALL show one full-width button at the bottom of the sheet, "Add transaction" for a new transaction and "Save changes" for an existing one.

#### Scenario: Add transaction saves
- **GIVEN** a new transaction of −23.50 to a payee on account Checking
- **WHEN** the user taps "Add transaction"
- **THEN** the sheet closes and the transaction is listed in Checking

### Requirement: Save and add another
The system SHALL offer "Save + new" as a secondary button beside the full-width "Add transaction" on a new transaction, saving and reopening an empty sheet on the same account.

#### Scenario: Save and new resets form
- **GIVEN** a new transaction of −23.50 to a payee on account Checking
- **WHEN** the user taps "Save + new"
- **THEN** the transaction is saved and an empty sheet for Checking is shown

### Requirement: Recent payee chips
The system SHALL show the frequently used payees as chips in the category-chip style on the new transaction sheet; tapping one sets the payee and applies its rules.

#### Scenario: Recent payee chip fills payee
- **GIVEN** a frequently used payee with a rule setting category Food
- **WHEN** the user taps its chip
- **THEN** payee is that payee and category is Food

### Requirement: Delete from the overflow menu
The system SHALL offer delete for a saved transaction only from the sheet header's overflow menu.

#### Scenario: Delete from overflow menu
- **GIVEN** a saved transaction open for editing
- **WHEN** the user opens the overflow menu and chooses Delete
- **THEN** the transaction is removed from the register

### Requirement: Split save waits for full assignment
The system SHALL show the amount left to assign while splitting and block saving until it is 0.

#### Scenario: Unbalanced split blocks save
- **GIVEN** a −100.00 split with −60.00 assigned
- **WHEN** the split screen renders
- **THEN** it shows −40.00 remaining and the save button is disabled

#### Scenario: Balanced split saves
- **GIVEN** a −100.00 split with −100.00 assigned
- **WHEN** the user taps the save button
- **THEN** the split transaction is saved

### Requirement: Payee picker sections
The system SHALL show, while picking a payee, a create option for an unknown name, matching payees, and transfer accounts in their own section.

#### Scenario: New name offers create
- **GIVEN** no payee named "Corner Bakery"
- **WHEN** the user types "Corner Bakery"
- **THEN** a "Create payee “Corner Bakery”" option is first

#### Scenario: Transfer targets listed
- **GIVEN** an account named Savings
- **WHEN** the payee picker opens
- **THEN** Savings appears under a transfer section, apart from payees

### Requirement: Long-list pickers fill the screen
The system SHALL open the payee, category, category group and account pickers full screen on the phone, while short menus stay bottom sheets.

#### Scenario: Payee picker fills the screen
- **GIVEN** the new transaction sheet on a 390x844 phone
- **WHEN** the payee field is tapped
- **THEN** the picker covers the whole viewport

#### Scenario: Short menu stays a sheet
- **GIVEN** a saved transaction open for editing
- **WHEN** the overflow menu opens
- **THEN** it does not cover the whole viewport

### Requirement: Keyboard opens on a new transaction on iOS
The system SHALL, on iOS, open the on-screen keyboard on the amount when a new transaction is opened by a tap.

#### Scenario: Tap primes the keyboard once
- **GIVEN** an iOS device
- **WHEN** the user taps Add
- **THEN** a hidden decimal field takes focus within that tap, and the amount field consumes the primed state exactly once
