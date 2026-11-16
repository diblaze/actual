## Purpose
The phone shell around every screen: when the phone layout applies, the floating tab bar and Add button, the More sheet, the large-title header, overlays, toasts, zoom, focus and theme contrast.

## ADDED Requirements

### Requirement: Phone layout below 730 pixels
The system SHALL render the phone layout when the window is narrower than 730px, the tablet layout from 730px to 1099px, and the desktop layout from 1100px up.

#### Scenario: Phone layout at 600px wide
- **GIVEN** a window 600px wide
- **WHEN** the budget page opens
- **THEN** the phone budget page renders and no sidebar is shown

#### Scenario: Desktop layout at 1100px wide
- **GIVEN** a window 1100px wide
- **WHEN** the budget page opens
- **THEN** the desktop budget page renders

### Requirement: Floating tab bar
The system SHALL show on the phone layout a floating bottom tab bar, inset from the screen edges, with exactly Budget, Transactions, Accounts, Reports and More, each with icon and label and at least 44px tall, marking the current destination with a pill and an accessible current-page state.

#### Scenario: Five destinations visible
- **GIVEN** the phone layout on the budget page
- **WHEN** the page renders
- **THEN** the bar shows Budget, Transactions, Accounts, Reports and More, each with an icon and a text label

#### Scenario: Current destination marked
- **GIVEN** the phone layout on the reports page
- **WHEN** the bar renders
- **THEN** the Reports tab has `aria-current="page"` and a highlighted pill, and no other tab does

#### Scenario: Account page keeps navigation
- **GIVEN** the phone layout
- **WHEN** a single account's transaction list opens
- **THEN** the bottom bar is visible

### Requirement: Floating Add button
The system SHALL show a floating "Add" button above the tab bar on the budget and transaction screens that opens a new transaction, preset to the account being viewed.

#### Scenario: Add from budget
- **GIVEN** the phone budget page
- **WHEN** the user taps Add
- **THEN** a new transaction opens

#### Scenario: Add from an account keeps the account
- **GIVEN** the phone register of account Checking
- **WHEN** the user taps Add
- **THEN** the new transaction's account is Checking

### Requirement: More sheet
The system SHALL open a sheet from the More tab listing Schedules, Payees, Rules, Tags, Bank sync (only with a sync server), Settings, Switch budget file and Help.

#### Scenario: More opens remaining destinations
- **GIVEN** the phone layout with a sync server
- **WHEN** the user taps More
- **THEN** a sheet lists Schedules, Payees, Rules, Tags, Bank sync, Settings, Switch budget file and Help, and choosing one navigates there and closes the sheet

#### Scenario: Bank sync hidden without server
- **GIVEN** the phone layout with no sync server
- **WHEN** the user taps More
- **THEN** the sheet has no Bank sync entry

### Requirement: Navigation stays put while scrolling
The system SHALL keep the tab bar in place while content scrolls.

#### Scenario: Scrolling down keeps navigation
- **GIVEN** the phone budget page with more categories than fit the screen
- **WHEN** the user scrolls down
- **THEN** the tab bar stays fully visible

### Requirement: Content clears the floating controls
The system SHALL pad the tab bar by the device's bottom safe-area inset and let every list scroll its last row fully above the tab bar and the Add button.

#### Scenario: Nav clears home indicator
- **GIVEN** a device that reports a bottom safe-area inset
- **WHEN** the tab bar renders
- **THEN** its distance from the bottom edge includes that inset

#### Scenario: Last row reachable above Add
- **GIVEN** the phone budget page scrolled to the end
- **WHEN** the last category row is shown
- **THEN** its bottom edge is above the Add button's top edge

### Requirement: Large-title page header
The system SHALL show each phone page's title as a 34px heading below a row of round header buttons, each button at least 44px.

#### Scenario: Large title and round buttons
- **GIVEN** the phone layout
- **WHEN** the accounts page opens
- **THEN** a level-1 heading "Accounts" renders at 34px and the "Add account" button is at least 44 by 44px

### Requirement: Toasts sit above the navigation
The system SHALL place notifications on the phone layout above the tab bar.

#### Scenario: Toast clears navigation
- **GIVEN** the phone budget page
- **WHEN** a notification appears
- **THEN** the notification's bottom edge is above the tab bar's top edge

### Requirement: Phone dialogs open as bottom sheets
The system SHALL show dialogs on the phone layout as full-width sheets anchored to the bottom with rounded top corners, at most 90% of the visible height, scrolling inside when taller.

#### Scenario: Menu opens as bottom sheet
- **GIVEN** the phone layout at 390px wide
- **WHEN** the budget month menu opens
- **THEN** the dialog spans the full width and its bottom edge touches the bottom of the viewport

#### Scenario: Tall menu scrolls inside sheet
- **GIVEN** the phone layout at 360x740
- **WHEN** the account menu opens
- **THEN** the sheet is no taller than 90% of the viewport and every item is reachable by scrolling inside it

### Requirement: Dialogs are named by their title
The system SHALL give each dialog that has a title that title as its accessible name.

#### Scenario: Dialog named by its title
- **GIVEN** a dialog whose header title is "Entertainment"
- **WHEN** it opens
- **THEN** the dialog's accessible name is "Entertainment", not "Modal dialog"

### Requirement: Pinch zoom allowed
The system SHALL allow the user to zoom the page.

#### Scenario: Viewport allows zoom
- **GIVEN** the app's HTML page
- **WHEN** its viewport meta tag is read
- **THEN** it contains neither `user-scalable=no` nor `maximum-scale=1`

### Requirement: Touch inputs at least 16px
The system SHALL render text inputs at 16px or larger on touch screens, so focusing one does not zoom the page.

#### Scenario: Inputs at least 16px on touch
- **GIVEN** a touch-screen phone on the new transaction form
- **WHEN** the notes field renders
- **THEN** its computed font size is at least 16px

### Requirement: Visible keyboard focus
The system SHALL show a visible focus indicator on tab bar items, header buttons and the Add button when reached by keyboard.

#### Scenario: Keyboard focus visible on tab
- **GIVEN** the phone budget page
- **WHEN** the user moves keyboard focus to the Reports tab
- **THEN** the tab shows a focus outline or ring that is not shown without focus

### Requirement: Readable theme colours
The system SHALL keep body text, secondary text, button text, banner actions and every Balance pill at a contrast of at least 4.5:1 against its background in the light, dark and midnight themes.

#### Scenario: Text pairs pass contrast in every theme
- **GIVEN** the light, dark and midnight theme definitions
- **WHEN** each text colour is measured against its background
- **THEN** every pair is at least 4.5:1
