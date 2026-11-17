# Credit Card Payment Categories

<ExperimentalFeatureWarning issueId="1995" />

## What it is

With this feature turned on, an on-budget account can be added as a credit card, the way nYNAB handles cards. Actual then creates a payment category for the card, named after the account, in a **Credit Card Payments** group. The payment category holds the money you need to pay the card off.

It works with envelope budgeting only. Off-budget accounts cannot be credit cards.

## Adding a card

When adding a local account, tick **Credit card** (desktop and mobile). This cannot be changed later, as in YNAB: an existing account cannot become a card, and a card cannot stop being one.

To turn an existing account into a card, add a new account with **Credit card** ticked, move the old account's transactions to it (select them all, then **Account**), and close the old account. Then clear the category of the moved starting balance: categorised as Starting Balances it would count as income on the card.

Each card has exactly one payment category, created with the card; it cannot be made by hand or linked to another card. It is named after the card's account and follows it when you rename the account. While the feature is on, the payment category cannot be renamed, hidden or deleted, and the group holding it cannot be hidden or deleted; you can still move them.

If the Credit Card Payments group already holds a category named after the card (for example from a manual workaround), adding the card turns that category into its payment category. Deleting a card account turns its payment category back into an ordinary category.

The Credit Card Payments group is created at the top of the budget.

## How spending moves

When you categorise a card purchase, the part of it the category can cover moves into the card's payment category:

- **Funded spending:** Food has 500 and you pay 400 with the card. Food keeps 100 and the payment category gets 400.
- **Credit overspending:** Food has 300 and you pay 500 with the card. 300 moves to the payment category and Food shows -200. That 200 is new debt on the card. Unlike cash overspending, it does not reduce next month's To Budget. If you budget more into Food later in the month, the extra covers the debt and moves to the payment category.
- **Card payments:** a transfer from your checking account to the card reduces the payment category.
- **Refunds:** a categorised refund on the card first cancels that card's unfunded debt in the category. Only the rest moves back from the payment category.
- **Income on the card** (cashback, statement credits) reduces the payment category.

Each month, cash spending in a category is counted before card spending. Card transactions are then funded in date order; card transactions on the same date are funded in the order they were entered (from the bottom of that day in the register upward).

## Rollover overspending

- **Off:** at the end of the month the category starts over at zero. The credit overspending stays as debt on the card, so the payment category holds less than the card balance. Only cash overspending is taken from next month's To Budget.
- **On:** the whole negative balance rolls into next month, including the card debt. Money that arrives in the category next month covers that card debt first and moves to the payment category.

## Good to know

- Adding a card, reordering payment categories, and turning the feature on or off rebuild the budget.
- The 3, 6 and 12 month average budget actions skip payment categories.
- A card's starting balance is categorised like any other starting balance. The starting debt therefore lowers To Budget, and the same amount is set aside in the payment category.
- Turning the feature off turns payment categories back into ordinary categories, and all numbers return to Actual's normal behaviour.
- Undo history and changes synced from older app versions can still rename or hide a payment category; renaming the card account restores its name, and a hidden payment category keeps **Show** in its menu.
- With the feature off, a payment category can be deleted. Turning the feature back on does not recreate it; replace the card account as described above.
