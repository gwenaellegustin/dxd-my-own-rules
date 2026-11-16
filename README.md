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
  favicon.png      browser tab icon (64px, from the AW conseils logo)
  images/          logo.png (header), car damage diagram exported from Figma,
                   registration/ (vehicle registration documents)
src/
  styles/          _tokens.scss (CSS variables), _breakpoints.scss, _side-panel.scss
  styles.scss      base styles and shared form controls
  app/
    core/          models, API access, services (worksheet & invoice stores, language, user…)
    layout/        application header, panels layout (left panel | work area | transcript),
                   transcript panel (common to the whole app)
    shared/        icon, vehicle logo, vehicle sidebar (cards list), vehicle info dialog,
                   modal dialog, money pipe, form helpers
    features/
      worksheet/   worksheet page: details, task line, carry-over dialog
      invoice/     invoice page and invoice document
      clients/     clients page (vehicles, open worksheets, invoices)
      shopping-list/   empty page (not designed yet)
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
  of their owners. The Triumph logo is not in Simple Icons: it comes from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_Triumph.svg) (public domain).
  A brand without a logo can set `"kind": "motorcycle"` to show a motorcycle instead of a car.
- **No hard-coded data** — everything comes from `public/mock-api/*.json` through `ApiService`.
  Point `API_BASE_URL` (`core/api/api.config.ts`) to the real backend when it exists.
  The worksheet content (sections, lines, options) is described in `worksheet-settings.json`:
  one template per kind of vehicle (car, motorcycle), with the default values of a new worksheet,
  and the planning rules.
- **Translations** — [ngx-translate](https://ngx-translate.org) with `public/i18n/{lang}.json`.
  English is the default; the EN / FR switch (top right) changes it and the choice is remembered.
  The French texts reuse the wording of the garage's paper worksheet.
  To add a language: add `xx.json` and its code to `SUPPORTED_LANGUAGES` (`language.service.ts`).

## Statuses

- **Worksheet**: *open* (work in progress, car on the lift) → *invoiced* (its invoice exists).
- **Invoice**: *open* (being prepared) → *sent* → *paid*.

"Create the invoice" on a worksheet creates its open invoice from the done lines (one item per
line, counted in the unit of its section: `invoiceUnit` in `worksheet-settings.json`), marks the
worksheet invoiced and opens the invoice.

An **invoiced worksheet is read-only** (the store refuses its edits, the fields are disabled and a
notice says why); its button becomes *Open invoice*. The only exception is *Observations and
tips*, editable from the invoice while it is open. Invoicing clears the undo history.

## Worksheet settings

Account menu (top right) → *Worksheet settings*, for cars or motorcycles (each kind has its own
lines: a worksheet takes the kind of its vehicle; the motorcycle template only has "Other" lines
for now):

- **Default values**: the lines of the worksheet. Drag a line by its handle to reorder it (inside
  its section), rename it (French and English side by side), add / edit / delete its fields
  (text, number, date, text area, fixed text, radio buttons, checkboxes, with their options) and
  set their default value in a new worksheet. Edited texts are written into the translations
  (`TemplateTextService`, keys `custom.*`), so every page shows them at once; a shared key is
  copied first so editing one line never changes another.
- **Planning rules**: when a line is planned (optionally only with one option, e.g. Service → Small), other lines are
  planned too, in the same undo step. They are never unplanned automatically. Mock rules: a small
  or medium service plans the oil filter and the engine oil; a big service plans the 3 filters and
  the engine oil.

Settings are kept in memory like the rest of the data.

## Invoice page

- Left panel: open invoices on top, then *Sent* and *Paid* (newest first). The transcript stays
  on the right, as on the worksheet page.
- The invoice follows the garage's paper invoice: vehicle, plate, kilometers, hourly rate, one
  table per section (quantity, price, % discount, amount), net total, VAT, total (rounded to
  5 centimes), payment term and observations.
- Vehicle, client, kilometers and *Observations and tips* come from the worksheet (its
  *Comments and tips*). VAT, payment term, hourly rates and contact details are in
  `company.json`.
- The client address and the vehicle plate come from `clients.json` (each vehicle has its plate).
- A new invoice takes the hourly rate of the client (`rateId` in `clients.json`), else the default one.
- Open invoices are editable: hourly rate (list of the rates of `company.json`; the labour lines
  take its price), quantity, price, discount, observations. Sent and paid ones are read-only.
- Buttons under the invoice: *Save as PDF* (always; the browser print dialog, the print styles keep
  only the invoice and show plain values), *Mark as sent* (open: payment term from that day),
  *Mark as paid* (sent).

## Clients page

- Same layout, without the transcript panel (`[withTranscript]="false"` on `app-panels-layout`).
- Left: the clients (name, town) and *New client*. Right: the client's name, address and hourly
  rate of its invoices (editable, saved while typing), its vehicles, its open worksheets and its
  invoices (total and status open / sent / paid); each row links to the worksheet or invoice.
- Worksheets refer to their client and vehicle by name: renaming a client or a vehicle renames
  them in its worksheets too (`WorksheetStore.rename`, when the field is left).
- Vehicle tiles (brand logo, plate) filter the worksheets and invoices; all are selected when a
  client is opened. The button of a tile opens its *Vehicle info*; *Add a vehicle* creates one
  (not kept if closed empty).

## Vehicle info

The vehicle file (in `clients.json`), opened from a worksheet (button next to the vehicle) or a
client: brand / model, plate, car or motorcycle, owner (read-only), the registration document
(click to zoom, the zoom follows the mouse) and a note. Only the Kia has a document in the mock
data; for the others, a photo can be dropped or chosen. There is no backend yet, so this upload is
fake: the photo is read in the browser and kept until the page is reloaded. Opened from a
worksheet whose vehicle has no file yet, the file is created (with its client if needed); from an
invoiced worksheet it is read-only.

## Line behaviour

- The note button opens the note field; it is hidden while the field is shown.
- An empty note field closes when you click outside it.
- Typing the first character of a note checks *Planned* (it can be unchecked afterwards).
- "Create the invoice" first lists the lines planned but not done, all checked: the checked ones
  are kept in `worksheet.carryOver` for the next intervention, then the invoice page opens.
  Each item can also be marked *Done* (it is then not carried over), and a link under each
  section unchecks / checks all its items.
- "Other" lines (free text) have no note; as soon as one is filled, a new empty "Other" line
  appears under it (template lines with `"repeatable": true`). In place of the note button they
  have a delete button that removes the line (not shown on the trailing empty line). Typing the
  first character in an empty "Other" line checks *Planned* (it can be unchecked afterwards).
  Like the note, the ✕ empties the line but keeps it; an emptied line is removed when you click
  outside it.
- *Planned* and *Done* toggle independently; the note stays visible.
- Radio groups hold 0 or 1 value: clicking the selected option clears it.
- **Ctrl+Z** undoes the last edit on the worksheet (text, checkbox, radio, damage mark, added or
  removed line), **Ctrl+Y** / **Ctrl+Shift+Z** redoes it. Typing in one field is one undo step
  (a pause of 1 s starts a new one). History is kept in `WorksheetStore`.
- Background: white (not planned) → blue (planned) → green (done).

## Responsive

| Width        | Side panels                                                       |
| ------------ | ----------------------------------------------------------------- |
| ≥ 1200px     | Inline, open (300px) or collapsed rail (76px)                     |
| 640 – 1199px | Rails inline, opened panel overlays the work area                 |
| < 640px      | Rails become a toolbar above the work area, panels are full screen |

The work area content uses container queries, so it adapts to the space left by the panels.
