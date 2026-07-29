# PS AM SQL Assistant (Simple Edition)

A small, plain Node.js demo with two pages:

1. **SQL Generator** — ask a question in plain English, get back a SQL
   `SELECT` statement (with an explanation and a row-count estimate), then
   run it against sample PeopleSoft-style Asset Management data.
2. **Impact Analyzer** — paste any SQL (one statement or several, including
   `INSERT`/`UPDATE`/`DELETE`, even `DROP`/`ALTER`) and see exactly what it
   would do — rows affected, rows returned, errors — **without it ever being
   permanently applied**. Every analysis runs inside a database transaction
   that is always rolled back at the end.

No TypeScript, no build step, no framework on the frontend, no native
database driver to compile. Just Node.js + Express + a couple of files.

## Tech stack

| Piece | Choice | Why |
|---|---|---|
| Server | Node.js + Express | Nothing to build or compile — `node server.js` and you're running |
| Database | [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) | Zero native dependencies — installs the same way every time in Codespaces, no compiler toolchain needed |
| AI | `@anthropic-ai/sdk` | Generates the SQL from your question |
| Frontend | Plain HTML + CSS + vanilla JS | No build step, two static pages served directly by Express |

The database lives entirely in memory and is rebuilt from
`db/schemaDefinition.js` + `db/seedData.js` every time the server starts.
There's no database file to manage, migrate, or reset — just restart the
server for a clean slate.

## Quickstart (GitHub Codespaces)

1. Open this repo in a Codespace (**Code → Create codespace on main**). The
   dev container runs `npm install` for you automatically.
2. Add your Anthropic API key. Open `.env` (created automatically from
   `.env.example`) and set:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
   Get a key at https://console.anthropic.com/
3. Start the server:
   ```bash
   npm start
   ```
   or, for auto-restart on file changes:
   ```bash
   npm run dev
   ```
4. Codespaces will prompt you to open the forwarded port `3000` in a
   browser — or click the **Ports** tab and open it manually.
5. You'll land on the SQL Generator page. Use the top nav to switch to the
   Impact Analyzer.

### Sanity-checking the database without starting the server
```bash
npm run reseed
```
This builds the in-memory database from your schema/seed files and prints a
row count per table — a quick way to confirm everything's wired up
correctly after you edit `schemaDefinition.js` or `seedData.js`.

## Project structure

```
ps-am-sql-assistant/
├── .devcontainer/
│   └── devcontainer.json       # Codespaces config — installs deps automatically
├── db/
│   ├── schemaDefinition.js     # ⭐ Edit this to add/change tables & columns
│   ├── seedData.js             # ⭐ Edit this to change sample data
│   ├── database.js             # Builds the in-memory SQLite DB from the two files above
│   └── reseed.js               # Standalone sanity-check script (npm run reseed)
├── services/
│   ├── schemaContext.js        # Turns schemaDefinition.js into text for the AI prompt
│   ├── sqlSafety.js            # Statement classification + safety checks
│   └── aiService.js            # Calls Claude to generate SQL (prompt lives here)
├── routes/
│   ├── generate.js             # POST /api/generate-sql, POST /api/run-select
│   └── impact.js               # POST /api/analyze-impact
├── public/
│   ├── index.html              # SQL Generator page
│   ├── impact.html             # Impact Analyzer page
│   ├── style.css               # Shared styling
│   ├── generate.js             # Client-side JS for the Generator page
│   └── impact.js               # Client-side JS for the Analyzer page
└── server.js                   # Entry point — run with `node server.js`
```

## Updating the database schema later

Everything about the database lives in two files:

1. **`db/schemaDefinition.js`** — add a new entry to the `tables` object to
   create a new table (name, description, columns, primary key). This same
   file is what generates the AI's schema knowledge, so the assistant
   automatically knows about your new table — nothing else to configure.
2. **`db/seedData.js`** — add a matching array of sample rows, keyed by the
   same table name.

Restart the server (`npm start`) or run `npm run reseed` to rebuild the
database with your changes. There are no migrations to write — the whole
database is just recreated from these two files on every startup.

## Sample data

The demo ships with PeopleSoft-style Asset Management tables:

- **PS_BU_TBL** — Business Units (`BUSINESS_UNIT`, `DESCR`, `CURRENCY_CD`)
- **PS_LOCATION_TBL** — Locations (`LOCATION`, `DESCR`, `CITY`, `COUNTRY`)
- **PS_CATEGORY_TBL** — Asset Categories (`CATEGORY`, `DESCR`, `USEFUL_LIFE`)
- **PS_ASSET** — Asset master records (`ASSET_ID`, `TAG_NUMBER`, `DESCR`,
  `BUSINESS_UNIT`, `CATEGORY`, `LOCATION`, `ASSET_STATUS`,
  `ACQUISITION_DT`, `COST`, `CURRENCY_CD`)
- **PS_DEPRECIATION** — Per-period depreciation rows (`DEPR_ID`, `ASSET_ID`,
  `FISCAL_YEAR`, `PERIOD`, `DEPR_AMOUNT`, `ACCUM_DEPR`, `NET_BOOK_VALUE`)

60 sample assets are generated across 3 business units, 5 locations, and 5
categories — with a realistic mix of statuses, and some assets deliberately
left without depreciation rows (so "find assets without depreciation"
actually returns results).

## Safety notes

- The **SQL Generator** page only ever executes a single, validated `SELECT`
  statement — anything else is rejected with a clear reason.
- The **Impact Analyzer** page accepts anything, but wraps every run in a
  transaction that is always rolled back, so it's safe to experiment with
  destructive statements to see their effect.
- Both pages re-validate on the server side regardless of what the browser
  sends — a hand-edited query can't bypass either check.
