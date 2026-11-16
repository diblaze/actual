## Purpose
Desktop (1100 pixels and up): the sidebar as an inset card, the budget in group cards with an overspent shortcut and a category inspector, and the account register's filter chip, bulk toolbar and Upcoming/Posted sections.

## ADDED Requirements

### Requirement: Sidebar as an inset card
The system SHALL show the desktop sidebar as a rounded card inset from the window edges on the page background.

#### Scenario: Sidebar is an inset card
- **GIVEN** a 1440x900 window
- **WHEN** the budget page opens
- **THEN** the sidebar has rounded corners and a gap to the window's left and top edges

### Requirement: Redesigned sidebar by default
The system SHALL show the redesigned sidebar (navigation, account groups with balances, budget name and sync status) unless the user turns the new sidebar experimental feature off.

#### Scenario: New sidebar shown by default
- **GIVEN** a fresh budget with no experimental feature changed
- **WHEN** the desktop budget page opens
- **THEN** the redesigned sidebar renders, not the classic one

### Requirement: Budget groups as cards on desktop
The system SHALL show each category group of the desktop budget as a rounded card with a group total row, each category's Budgeted as an outlined field and its Balance as a pill coloured by state.

#### Scenario: Rows show outlined budgeted and balance pill
- **GIVEN** the desktop budget with category Food overspent
- **WHEN** it renders
- **THEN** Food's Budgeted has a visible outline and its Balance pill uses the overspent pill colours

#### Scenario: Desktop card overspending shows warning
- **GIVEN** Food budgeted 300.00 and 330.00 spent on a credit card
- **WHEN** the desktop budget renders
- **THEN** Food's Balance pill shows −30.00 in the warning colours

#### Scenario: Desktop carried card debt shows red
- **GIVEN** carry card debt on and Food 50.00 short on a card last month
- **WHEN** the next month renders on desktop
- **THEN** Food's Balance pill shows −50.00 in the negative colours

### Requirement: Overspent shortcut on desktop
The system SHALL show next to To budget, when N categories are overspent, an "N Overspent" card with a Fix button opening the overspent cover list.

#### Scenario: Desktop overspent Fix opens list
- **GIVEN** the desktop budget with three overspent categories
- **WHEN** the user presses Fix on "3 Overspent"
- **THEN** the list of overspent categories to cover opens

### Requirement: Budget inspector
The system SHALL show, for the selected category on the desktop budget, a side panel with its group, Balance, spent bar, Budgeted, Spent, Cover when overspent, Move money and recent transactions.

#### Scenario: Inspector shows balance and recent transactions
- **GIVEN** the desktop budget with category Food selected
- **WHEN** the inspector renders
- **THEN** it shows Food's group, Balance, Budgeted, Spent and up to four recent transactions

### Requirement: Register filter chips
The system SHALL offer a one-tap Uncleared chip above the desktop register that filters it.

#### Scenario: Uncleared chip filters list
- **GIVEN** an account with cleared and uncleared transactions
- **WHEN** the user turns on the Uncleared chip
- **THEN** only uncleared transactions are listed

### Requirement: Bulk action toolbar
The system SHALL show a toolbar with the selection count and bulk actions while transactions are selected.

#### Scenario: Selecting rows shows toolbar
- **GIVEN** the desktop register
- **WHEN** the user selects two transactions
- **THEN** a toolbar reads "2 selected" with categorize, clear and delete actions

### Requirement: Upcoming and posted sections
The system SHALL separate scheduled transactions under an Upcoming heading from posted ones under a Posted heading in the desktop register.

#### Scenario: Scheduled rows under Upcoming
- **GIVEN** an account with a scheduled transaction
- **WHEN** its desktop register opens
- **THEN** the scheduled row is under "Upcoming" and posted rows under "Posted"
