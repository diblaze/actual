## Purpose
The phone budget screen: group cards with Budgeted and Balance, coloured Balance pills, the To budget card, action banners, the category sheet and credit-card debt colours.

## ADDED Requirements

### Requirement: Budget groups as cards
The system SHALL show each category group as a rounded card under a heading with the group name and the group's Budgeted and Balance totals, and each category row with its name, Budgeted amount and Balance pill, rows at least 52px tall and amounts never below 12px.

#### Scenario: Category row shows budgeted and balance
- **GIVEN** a category with 400.00 budgeted and 1,000.22 balance, on a 360px-wide phone
- **WHEN** the budget renders
- **THEN** the row shows 400.00 and 1,000.22, is at least 52px tall, and both amounts are at least 12px

#### Scenario: Group heading shows totals
- **GIVEN** a group whose categories have 3,030.00 budgeted and 652.18 balance in total
- **WHEN** the budget renders
- **THEN** the group heading shows Budgeted 3,030.00 and Balance 652.18

### Requirement: Row taps route to their action
The system SHALL open the budget menu from a row's Budgeted amount and the category sheet from its name or Balance pill, each target at least 44px tall.

#### Scenario: Cell taps route to their action
- **GIVEN** a category row
- **WHEN** the user taps Budgeted, then the name, then Balance
- **THEN** Budgeted opens the budget menu, and the name and Balance each open the category sheet

### Requirement: Category names wrap to two lines
The system SHALL wrap a long category name onto at most two lines instead of truncating it to one.

#### Scenario: Long category name wraps
- **GIVEN** a category named "Entertainment & hobbies" on a 360px-wide phone
- **WHEN** the budget renders
- **THEN** the full name is visible on up to two lines and the row stays at its standard height

### Requirement: Balance pill coloured by state
The system SHALL show Balance as a pill coloured by its state (positive, warning, overspent, zero) whose amount always carries its sign.

#### Scenario: Overspent category shows sign and tint
- **GIVEN** a category with −94.19 balance and no card spending
- **WHEN** the budget renders
- **THEN** the pill reads "−94.19" in the overspent pill colours

#### Scenario: Zero balance shows neutral pill
- **GIVEN** a category with 0.00 balance
- **WHEN** the budget renders
- **THEN** the pill reads "0.00" in the zero pill colours

### Requirement: Card debt colours
The system SHALL, with card payment categories on, show card spending carried from earlier months as overspent (red), and show this month's uncovered card spending and a payment category short of its card balance as warning.

#### Scenario: Carried card debt shows red
- **GIVEN** card payment categories and carry card debt are on, and a category carries 50.00 of unpaid card spending from last month
- **WHEN** this month's phone budget renders
- **THEN** that category's Balance pill reads "−50.00" in the overspent pill colours

#### Scenario: This month's uncovered card spending shows warning
- **GIVEN** card payment categories are on and a category's card spending this month exceeds its budget by 30.00
- **WHEN** the phone budget renders
- **THEN** that category's Balance pill reads "−30.00" in the warning pill colours

#### Scenario: Unfunded card payment shows warning
- **GIVEN** card payment categories are on and a card's payment category holds less than the card balance
- **WHEN** the phone budget renders
- **THEN** the payment category's Balance pill uses the warning pill colours

### Requirement: To budget card
The system SHALL show To budget in a card with its signed amount and a "Move" button opening the To budget menu; when negative the card reads Overbudgeted and the button reads "Cover", opening the cover overbudgeted flow.

#### Scenario: To budget card opens its actions
- **GIVEN** an envelope budget with money to budget
- **WHEN** the user taps "Move" on the To budget card
- **THEN** the To budget menu opens with "Move to a category" first

#### Scenario: Overbudgeted card offers Cover
- **GIVEN** an envelope budget budgeted 50.00 more than available
- **WHEN** the user taps "Cover" on the card reading Overbudgeted
- **THEN** the cover overbudgeted category picker opens

### Requirement: Overspent banner
The system SHALL show, when N categories are overspent this month, a banner "N Categories overspent" with a Fix button that opens the existing overspent cover list.

#### Scenario: Overspent banner counts categories
- **GIVEN** four overspent categories this month
- **WHEN** the user taps Fix on the banner reading "4 Categories overspent"
- **THEN** the list of overspent categories to cover opens

#### Scenario: No overspending hides banner
- **GIVEN** no overspent categories this month
- **WHEN** the budget renders
- **THEN** no overspent banner is shown

### Requirement: Uncategorized banner on the budget
The system SHALL show, when uncategorized transactions exist, a banner "N Uncategorized" with a Show button that opens the uncategorized transactions list.

#### Scenario: Uncategorized banner opens list
- **GIVEN** two uncategorized transactions
- **WHEN** the user taps Show on the budget's banner reading "2 Uncategorized"
- **THEN** the uncategorized transactions list opens

### Requirement: Category sheet
The system SHALL open a sheet for a category showing its name, Balance, Budgeted and Spent, and actions to move money, show transactions, and rename or hide; plus a "Cover" action for the overspent amount when overspent.

#### Scenario: Category sheet for overspent category
- **GIVEN** a category overspent by 94.19
- **WHEN** its sheet opens
- **THEN** it shows Balance "−94.19" and offers "Cover 94.19"

#### Scenario: Funded category sheet omits cover
- **GIVEN** a category with a positive balance
- **WHEN** its sheet opens
- **THEN** no Cover action is offered and Move money, Show transactions and Rename or hide are offered

### Requirement: Spent bar in the category details
The system SHALL show in the category details a bar of spent against budgeted with the percentage as its accessible name.

#### Scenario: Spent bar shows percent
- **GIVEN** a category with 400.00 budgeted and −100.00 spent
- **WHEN** its sheet opens
- **THEN** the bar is a quarter full and is named "25 percent of budget spent"

### Requirement: Recent transactions in the category details
The system SHALL list in the category details the category's four most recent transactions of the month, each with payee, date and signed amount.

#### Scenario: Sheet lists recent transactions
- **GIVEN** a category with five transactions this month
- **WHEN** its sheet opens
- **THEN** the four latest are listed newest first with payee, date and signed amount
