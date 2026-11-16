## Purpose
Tablet widths from 730 to 1099 pixels: a floating glass icon rail instead of the sidebar, a three-column budget and a category panel beside it.

## ADDED Requirements

### Requirement: Glass icon rail at tablet width
The system SHALL show, from 730px to 1099px, an inset rounded rail with Budget, Transactions, Accounts, Reports and More as labelled icons, the current one marked, and a round "Add transaction" button at its foot, in place of the sidebar.

#### Scenario: Rail shows labelled destinations
- **GIVEN** a 1024x768 window
- **WHEN** the budget page opens
- **THEN** a rail shows Budget, Transactions, Accounts, Reports and More with labels, Budget marked current, plus "Add transaction", and no sidebar

### Requirement: Three-column budget on tablet
The system SHALL show Budgeted, Spent and Balance for each category from 730px to 1099px.

#### Scenario: Tablet rows show three amounts
- **GIVEN** a 1024x768 window and a category with 400.00 budgeted and −100.00 spent
- **WHEN** the budget renders
- **THEN** its row shows 400.00, −100.00 and its Balance pill

#### Scenario: Tablet card overspending shows warning
- **GIVEN** a 1024x768 window, Food budgeted 300.00 and 330.00 spent on a credit card
- **WHEN** the tablet budget renders
- **THEN** Food's Balance pill shows −30.00 in the warning colours

#### Scenario: Tablet carried card debt shows red
- **GIVEN** a 1024x768 window, carry card debt on and Food 50.00 short on a card last month
- **WHEN** the next month renders on the tablet budget
- **THEN** Food's Balance pill shows −50.00 in the negative colours

### Requirement: Category panel beside the budget
The system SHALL show, from 730px to 1099px, the selected category's details (Balance, Budgeted, Spent, spent bar, Cover when overspent, Move money and recent transactions) beside the budget list, with the selected row highlighted.

#### Scenario: Selecting a category fills inspector
- **GIVEN** a 1024x768 window on the budget page
- **WHEN** the user selects category Food
- **THEN** the right panel shows Food's Balance, Budgeted, Spent, Move money and recent transactions, Food's row is highlighted, and the list stays visible
