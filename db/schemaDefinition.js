/**
 * schemaDefinition.js
 * ---------------------------------------------------------------------------
 * This is the ONE file that describes the database structure. Table
 * creation (db/database.js) and the AI's schema knowledge
 * (services/schemaContext.js) are both derived from what's defined here.
 *
 * TO ADD OR CHANGE A TABLE LATER:
 *   1. Add/edit an entry in the `tables` object below (name, description,
 *      columns, primaryKey).
 *   2. Add matching sample rows in db/seedData.js.
 *   3. Restart the server (or run `npm run reseed`) — the database is
 *      rebuilt from scratch every time the app starts.
 *
 * `knownValues` (optional) lists the real values a status/code/category
 * column can hold, e.g. ASSET_STATUS: ['IN_SERVICE', 'DISPOSED', 'RETIRED'].
 * This is what stops the AI from guessing a plausible-looking but wrong
 * literal (like 'INSERVICE'). It's a small, static, hand-maintained list —
 * deliberately simple: no live database queries are needed to build the
 * AI's schema context, which keeps every request small and predictable.
 * Keep these lists in sync with db/seedData.js when you change the data.
 *
 * Column type strings use plain SQLite types: TEXT, INTEGER, REAL.
 * ---------------------------------------------------------------------------
 */

const tables = {
  PS_BU_TBL: {
    description: 'Business Unit — the PeopleSoft organizational unit an asset belongs to.',
    primaryKey: 'BUSINESS_UNIT',
    columns: {
      BUSINESS_UNIT: 'TEXT',
      DESCR: 'TEXT',
      CURRENCY_CD: 'TEXT',
    },
    knownValues: {
      BUSINESS_UNIT: ['US001', 'IN001', 'UK001'],
      CURRENCY_CD: ['USD', 'INR', 'GBP'],
    },
  },

  PS_LOCATION_TBL: {
    description: 'Physical location where an asset is held.',
    primaryKey: 'LOCATION',
    columns: {
      LOCATION: 'TEXT',
      DESCR: 'TEXT',
      CITY: 'TEXT',
      COUNTRY: 'TEXT',
    },
    knownValues: {
      LOCATION: ['HYD01', 'BLR01', 'NYC01', 'SFO01', 'LON01'],
      COUNTRY: ['IN', 'US', 'UK'],
    },
  },

  PS_CATEGORY_TBL: {
    description: 'Asset category, used to group similar assets and determine useful life.',
    primaryKey: 'CATEGORY',
    columns: {
      CATEGORY: 'TEXT',
      DESCR: 'TEXT',
      USEFUL_LIFE: 'INTEGER',
    },
    knownValues: {
      CATEGORY: ['IT_EQUIP', 'FURNITURE', 'VEHICLE', 'MACHINERY', 'SOFTWARE'],
    },
  },

  PS_ASSET: {
    description: 'Asset master record — one row per physical/financial asset.',
    primaryKey: 'ASSET_ID',
    columns: {
      ASSET_ID: 'TEXT',
      TAG_NUMBER: 'TEXT',
      DESCR: 'TEXT',
      BUSINESS_UNIT: 'TEXT',
      CATEGORY: 'TEXT',
      LOCATION: 'TEXT',
      ASSET_STATUS: 'TEXT',
      ACQUISITION_DT: 'TEXT',
      COST: 'REAL',
      CURRENCY_CD: 'TEXT',
    },
    knownValues: {
      ASSET_STATUS: ['IN_SERVICE', 'DISPOSED', 'RETIRED'],
    },
  },

  PS_DEPRECIATION: {
    description: 'Depreciation schedule rows for an asset. Not every asset has rows here — an asset with none has not yet had depreciation calculated.',
    primaryKey: 'DEPR_ID',
    columns: {
      DEPR_ID: 'INTEGER',
      ASSET_ID: 'TEXT',
      FISCAL_YEAR: 'INTEGER',
      PERIOD: 'INTEGER',
      DEPR_AMOUNT: 'REAL',
      ACCUM_DEPR: 'REAL',
      NET_BOOK_VALUE: 'REAL',
    },
  },
};

module.exports = { tables };