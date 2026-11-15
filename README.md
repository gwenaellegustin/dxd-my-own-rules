# Garage

Prototype of a garage management web app (desktop first, responsive), built with Angular 22.
Design source: Figma "Simple Design System (Community)", page **Examples**, frame *MacBook Air - 1*.

## Getting started

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build in dist/
```

## Deployment

Every push on `main` builds the app and publishes it on GitHub Pages
(`.github/workflows/deploy.yml`): https://gwenaellegustin.github.io/dxd-my-own-rules/

Asset URLs must stay relative (no leading `/`) because the site is served from a sub-path.

## Project structure

```
public/
  i18n/            en.json, fr.json — every UI text (translation keys)
  mock-api/        JSON files standing in for the backend
  images/          car damage diagram exported from Figma
src/
  styles/          _tokens.scss (CSS variables), _breakpoints.scss, _side-panel.scss
  styles.scss      base styles and shared form controls
  app/
    core/          models, API access, services (store, language, user…)
    layout/        application header
    shared/        icon, placeholder page
    features/
      worksheet/   worksheet page: sidebar, details, task line, transcript
      invoice/, clients/, shopping-list/   empty pages (not designed yet)
```

## Conventions

- **Design tokens** — all colors, spacing, typography and sizes are CSS variables in
  `src/styles/_tokens.scss`. The current values are a greyscale wireframe: change them there to
  apply the final colors, components never hard-code values.
- **Form helpers** (`src/app/shared/`): `<app-clearable>` adds a ✕ reset button to a text field,
  `<app-combobox>` is a select that also accepts free text (client / vehicle, suggestions from
  `clients.json`), `appAutoGrow` makes a textarea grow with its content.
- **Icons** are [Google Material Symbols](https://fonts.google.com/icons) (`<app-icon name="…">`) and take the
  current text color. To add one, map it in `shared/icon/icon.ts` and add it to `icon_names` in `index.html`.
- **Brand logos** (`public/images/brands/`) come from [Simple Icons](https://simpleicons.org) and are
  listed in `mock-api/vehicle-brands.json` (with aliases, e.g. "vw" → Volkswagen). A worksheet card
  shows the logo when its vehicle matches a brand, otherwise the status icon. Logos are trademarks
  of their owners.
- **No hard-coded data** — everything comes from `public/mock-api/*.json` through `ApiService`.
  Point `API_BASE_URL` (`core/api/api.config.ts`) to the real backend when it exists.
  The worksheet content (sections, lines, options) is described in `worksheet-template.json`.
- **Translations** — [ngx-translate](https://ngx-translate.org) with `public/i18n/{lang}.json`.
  English is the default; the EN / FR switch (top right) changes it and the choice is remembered.
  The French texts reuse the wording of the garage's paper worksheet.
  To add a language: add `xx.json` and its code to `SUPPORTED_LANGUAGES` (`language.service.ts`).

## Line behaviour

- The note button opens the note field; it is hidden while the field is shown.
- An empty note field closes when you click outside it.
- "Create the invoice" first lists the lines planned but not done, all checked: the checked ones
  are kept in `worksheet.carryOver` for the next intervention, then the invoice page opens.
- "Other" lines (free text) have no note; as soon as one is filled, a new empty "Other" line
  appears under it (template lines with `"repeatable": true`). In place of the note button they
  have a delete button that removes the line (not shown on the trailing empty line). Typing the
  first character in an empty "Other" line checks *Planned* (it can be unchecked afterwards).
- *Planned* and *Done* toggle independently; the note stays visible.
- Radio groups hold 0 or 1 value: clicking the selected option clears it.
- Background: white (not planned) → blue (planned) → green (done).

## Responsive

| Width        | Side panels                                                       |
| ------------ | ----------------------------------------------------------------- |
| ≥ 1200px     | Inline, open (300px) or collapsed rail (76px)                     |
| 640 – 1199px | Rails inline, opened panel overlays the work area                 |
| < 640px      | Rails become a toolbar above the work area, panels are full screen |

The work area content uses container queries, so it adapts to the space left by the panels.
