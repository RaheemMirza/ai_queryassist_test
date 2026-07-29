/**
 * schemaDefinition.js
 * ---------------------------------------------------------------------------
 * This is the ONE file that describes the database structure. Everything
 * else in the app (table creation, the AI's schema knowledge, sample data
 * generation) is derived from what's defined here.
 *
 * TO ADD OR CHANGE A TABLE LATER:
 *   1. Add/edit an entry in the `tables` object below (name, description,
 *      columns, primaryKey).
 *   2. Add matching sample rows in db/seedData.js.
 *   3. Restart the server (or run `npm run reseed`) — the database is
 *      rebuilt from scratch every time the app starts, so there is nothing
 *      else to configure.
 *
 * Column type strings use plain SQLite types: TEXT, INTEGER, REAL.
 * ---------------------------------------------------------------------------
 */

const tables = {
  PS_BU_TBL: {
    description: 'Business Unit — the PeopleSoft organizational unit an asset belongs to.',
    primaryKey: 'BUSINESS_UNIT',
    columns: {
      BUSINESS_UNIT: 'TEXT',   // e.g. "US001"
      DESCR: 'TEXT',            // e.g. "US Corporate HQ"
      CURRENCY_CD: 'TEXT',      // e.g. "USD"
    },
  },

  PS_LOCATION_TBL: {
    description: 'Physical location where an asset is held.',
    primaryKey: 'LOCATION',
    columns: {
      LOCATION: 'TEXT',   // e.g. "HYD01"
      DESCR: 'TEXT',       // e.g. "Hyderabad Campus"
      CITY: 'TEXT',
      COUNTRY: 'TEXT',
    },
  },

  PS_CATEGORY_TBL: {
    description: 'Asset category, used to group similar assets and determine useful life.',
    primaryKey: 'CATEGORY',
    columns: {
      CATEGORY: 'TEXT',        // e.g. "IT_EQUIP"
      DESCR: 'TEXT',            // e.g. "IT Equipment"
      USEFUL_LIFE: 'INTEGER',  // useful life in years, used for depreciation calculations
    },
  },

  PS_ASSET: {
    description: 'Asset master record — one row per physical/financial asset.',
    primaryKey: 'ASSET_ID',
    columns: {
      ASSET_ID: 'TEXT',            // unique internal id, e.g. "A00001"
      TAG_NUMBER: 'TEXT',           // human-readable tag, e.g. "AM-000123"
      DESCR: 'TEXT',                 // e.g. "Dell Latitude 7440 Laptop"
      BUSINESS_UNIT: 'TEXT',       // FK -> PS_BU_TBL.BUSINESS_UNIT
      CATEGORY: 'TEXT',            // FK -> PS_CATEGORY_TBL.CATEGORY
      LOCATION: 'TEXT',            // FK -> PS_LOCATION_TBL.LOCATION
      ASSET_STATUS: 'TEXT',        // 'IN_SERVICE' | 'DISPOSED' | 'RETIRED'
      ACQUISITION_DT: 'TEXT',      // ISO date string, e.g. "2025-03-14"
      COST: 'REAL',                 // acquisition cost
      CURRENCY_CD: 'TEXT',
    },
  },

  PS_DEPRECIATION: {
    description: 'Depreciation schedule rows for an asset. Not every asset has rows here — an asset with none has not yet had depreciation calculated.',
    primaryKey: 'DEPR_ID',
    columns: {
      DEPR_ID: 'INTEGER',          // auto-increment surrogate key
      ASSET_ID: 'TEXT',            // FK -> PS_ASSET.ASSET_ID
      FISCAL_YEAR: 'INTEGER',
      PERIOD: 'INTEGER',            // 1-12
      DEPR_AMOUNT: 'REAL',          // depreciation amount for this period
      ACCUM_DEPR: 'REAL',           // accumulated depreciation as of this period
      NET_BOOK_VALUE: 'REAL',       // COST - ACCUM_DEPR as of this period
    },
  },
};

module.exports = { tables };
