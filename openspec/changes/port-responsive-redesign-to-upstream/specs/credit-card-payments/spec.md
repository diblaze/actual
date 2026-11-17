## Purpose
Credit card payment category rules that were re-resolved when the credit-card stack was rebased onto upstream: the phone menus of payment categories and their groups, partial category updates, and the card-debt explanation on a balance.

## ADDED Requirements

### Requirement: Payment category phone menu
The system SHALL offer neither rename nor delete in the phone menu of a credit card's payment category, and SHALL offer Show for it only while it is hidden.

#### Scenario: Payment category menu has no rename or delete
- **GIVEN** card payment categories are on and account Visa is a credit card
- **WHEN** the phone menu of Visa's payment category opens
- **THEN** it offers no rename, no delete and no hide

#### Scenario: Hidden payment category offers Show
- **GIVEN** Visa's payment category is hidden from before the feature was on
- **WHEN** its phone menu opens
- **THEN** it offers Show, and choosing it makes the category visible

### Requirement: Group holding a payment category stays
The system SHALL offer neither delete nor hide in the phone menu of a category group that holds a payment category.

#### Scenario: Group with payment category cannot be deleted or hidden
- **GIVEN** group Credit Cards holds Visa's payment category
- **WHEN** the group's phone menu opens
- **THEN** it offers no delete and no hide

### Requirement: Partial updates keep the card's name
The system SHALL keep a payment category's card name and visibility when a category update leaves them out.

#### Scenario: Partial update keeps card name
- **GIVEN** Visa's open card and its payment category named "Visa"
- **WHEN** the category is updated with only a new group
- **THEN** it is still named "Visa", visible, and sits in the new group

### Requirement: Card-debt explanation only with card debt
The system SHALL explain a balance's card debt in a tooltip only when the category has uncovered card spending or its card balance is not set aside.

#### Scenario: Plain overspending shows no card tooltip
- **GIVEN** a desktop category overspent by 20.00 on cash, with no card spending
- **WHEN** the user hovers its balance
- **THEN** no card-debt explanation is shown
