## Purpose
The port looks like the approved redesign: the key phone, tablet and desktop screens render the same as the redesign build at 901d6cb, with only the approved More sheet change and differences Denis signs off.

## ADDED Requirements

### Requirement: Key screens match the approved redesign
The system SHALL render the phone budget, category sheet, Transactions screen, transaction editor sheet, accounts list, settings, tablet budget and desktop budget the same as the approved redesign build in the light and dark themes on the same demo budget, except for the approved differences: the More sheet, the sheet drag handle, the goal ring, goal status and "Fund goal from To Budget" when goal templates are on, and the "Hide reconciled" menu row.

#### Scenario: Key screens match the 901d6cb baselines
- **GIVEN** screenshots of the key screens taken from the approved redesign build on the demo budget, at the same viewports and themes
- **WHEN** the same screens are shot on the ported build
- **THEN** every screenshot matches its baseline, and each mismatch is one of the approved differences
