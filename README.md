# Garage

Prototype of a garage management web app (desktop first, responsive), built with Angular 22.
Design source: Figma "Simple Design System (Community)", page **Examples**, frame *MacBook Air - 1*.

## Getting started

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build in dist/
```

## Project structure

```
public/
  i18n/            en.json, fr.json — every UI text (translation keys)
  mock-api/        JSON files standing in for the backend
  icons/, images/  assets exported from Figma
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
- **Icons** are rendered as CSS masks (`<app-icon name="…">`) and take the current text color.
- **No hard-coded data** — everything comes from `public/mock-api/*.json` through `ApiService`.
  Point `API_BASE_URL` (`core/api/api.config.ts`) to the real backend when it exists.
  The worksheet content (sections, lines, options) is described in `worksheet-template.json`.
- **Translations** — [ngx-translate](https://ngx-translate.org) with `public/i18n/{lang}.json`.
  The language follows the browser, can be changed from the avatar menu and is remembered.
  To add a language: add `xx.json` and its code to `SUPPORTED_LANGUAGES` (`language.service.ts`).

## Line behaviour (from the Figma prototype)

- The pencil button opens the note field.
- *Planned* and *Done* toggle independently; checking *Done* closes the note.
- Background: white (not planned) → blue (planned) → green (done).
- A dot on the pencil shows that a hidden note exists.

## Responsive

| Width        | Side panels                                                       |
| ------------ | ----------------------------------------------------------------- |
| ≥ 1200px     | Inline, open (300px) or collapsed rail (76px)                     |
| 640 – 1199px | Rails inline, opened panel overlays the work area                 |
| < 640px      | Rails become a toolbar above the work area, panels are full screen |

The work area content uses container queries, so it adapts to the space left by the panels.
