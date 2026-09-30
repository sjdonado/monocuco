## Purpose

Shows visitors of the repository what Monocuco looks like with real screenshots of the current interface, produced by a documented, scripted procedure, so that any later visual change can refresh them the same way.

## ADDED Requirements

### Requirement: README screenshots of the current UI

The README SHALL show one or two static WebP screenshots of the redesigned interface, captured from the production build with the published dataset. Interface text SHALL be legible at the width at which GitHub renders the README. Each image SHALL be at most 200 KB. The images SHALL NOT be animated. Each image SHALL have Spanish alt text that describes what it shows.

#### Scenario: Screenshots show the shipped design

- **WHEN** a visitor opens the README on GitHub after the change merges
- **THEN** the screenshots show the redesigned interface, not the previous design

#### Scenario: Size and legibility

- **WHEN** a screenshot file is checked
- **THEN** it is a static WebP of at most 200 KB, at a pixel density at which the word card text is readable without zooming

### Requirement: Reproducible capture procedure

A single command SHALL build the app and regenerate every README screenshot, with the same viewport, color scheme, page state and crop each time. It SHALL make no network request outside the local preview server. The procedure SHALL be documented step by step in the repository, together with when it must be run.

#### Scenario: Regenerating after a visual change

- **WHEN** a maintainer runs the documented command after changing how the header, search, word card or pagination look
- **THEN** the screenshots are regenerated at the same paths, sizes and framing, and the documentation names every check to run on the result

#### Scenario: Deterministic content

- **WHEN** the command runs twice on the same commit
- **THEN** both runs show the same words in the same state
