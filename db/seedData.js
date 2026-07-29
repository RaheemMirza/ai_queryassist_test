/**
 * seedData.js
 * ---------------------------------------------------------------------------
 * Sample rows for each table, keyed by table name (matching
 * db/schemaDefinition.js). Edit these arrays directly to change the demo
 * data, or add a new key here to match a new table you added to
 * schemaDefinition.js.
 *
 * PS_ASSET and PS_DEPRECIATION are generated programmatically below (so
 * there's a decent amount of realistic-looking data), but you're welcome to
 * replace `generateAssets()` with a hard-coded array if you'd rather curate
 * it by hand.
 * ---------------------------------------------------------------------------
 */

const businessUnits = [
  { BUSINESS_UNIT: 'US001', DESCR: 'US Corporate HQ', CURRENCY_CD: 'USD' },
  { BUSINESS_UNIT: 'IN001', DESCR: 'India Operations', CURRENCY_CD: 'INR' },
  { BUSINESS_UNIT: 'UK001', DESCR: 'UK Regional Office', CURRENCY_CD: 'GBP' },
];

const locations = [
  { LOCATION: 'HYD01', DESCR: 'Hyderabad Campus', CITY: 'Hyderabad', COUNTRY: 'IN' },
  { LOCATION: 'BLR01', DESCR: 'Bengaluru Tech Park', CITY: 'Bengaluru', COUNTRY: 'IN' },
  { LOCATION: 'NYC01', DESCR: 'New York Office', CITY: 'New York', COUNTRY: 'US' },
  { LOCATION: 'SFO01', DESCR: 'San Francisco HQ', CITY: 'San Francisco', COUNTRY: 'US' },
  { LOCATION: 'LON01', DESCR: 'London Office', CITY: 'London', COUNTRY: 'UK' },
];

const categories = [
  { CATEGORY: 'IT_EQUIP', DESCR: 'IT Equipment', USEFUL_LIFE: 4 },
  { CATEGORY: 'FURNITURE', DESCR: 'Office Furniture', USEFUL_LIFE: 7 },
  { CATEGORY: 'VEHICLE', DESCR: 'Company Vehicles', USEFUL_LIFE: 6 },
  { CATEGORY: 'MACHINERY', DESCR: 'Manufacturing Machinery', USEFUL_LIFE: 10 },
  { CATEGORY: 'SOFTWARE', DESCR: 'Capitalized Software', USEFUL_LIFE: 3 },
];

const descriptionsByCategory = {
  IT_EQUIP: ['Dell Latitude 7440 Laptop', 'Dell UltraSharp 27" Monitor', 'HP LaserJet Printer', 'Cisco Network Switch'],
  FURNITURE: ['Herman Miller Aeron Chair', 'Standing Desk - Adjustable', 'Conference Table (12-seat)', 'Filing Cabinet - 4 Drawer'],
  VEHICLE: ['Toyota Camry - Fleet Sedan', 'Ford Transit - Delivery Van', 'Toyota Hilux - Utility Truck'],
  MACHINERY: ['CNC Milling Machine', 'Industrial 3D Printer', 'Hydraulic Press'],
  SOFTWARE: ['PeopleSoft AM License', 'Oracle Database License', 'Power BI Enterprise License'],
};

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithinLastYears(years) {
  const now = new Date();
  const past = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  const date = new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Generates `count` assets plus their depreciation rows.
 * Returns { assets, depreciation } ready to insert.
 */
function generateAssets(count = 60) {
  const assets = [];
  const depreciation = [];
  let deprIdCounter = 1;

  for (let i = 1; i <= count; i++) {
    const category = randomFrom(categories);
    const businessUnit = randomFrom(businessUnits);
    const location = randomFrom(locations);
    const descr = randomFrom(descriptionsByCategory[category.CATEGORY]);
    const acquisitionDt = randomDateWithinLastYears(3);
    const cost = round2(500 + Math.random() * 60000);

    // ~15% disposed, ~5% retired, rest in service
    const roll = Math.random();
    const status = roll < 0.15 ? 'DISPOSED' : roll < 0.2 ? 'RETIRED' : 'IN_SERVICE';

    const assetId = `A${String(i).padStart(5, '0')}`;

    assets.push({
      ASSET_ID: assetId,
      TAG_NUMBER: `AM-${String(i).padStart(6, '0')}`,
      DESCR: descr,
      BUSINESS_UNIT: businessUnit.BUSINESS_UNIT,
      CATEGORY: category.CATEGORY,
      LOCATION: location.LOCATION,
      ASSET_STATUS: status,
      ACQUISITION_DT: acquisitionDt,
      COST: cost,
      CURRENCY_CD: businessUnit.CURRENCY_CD,
    });

    // ~75% of in-service/retired assets have depreciation rows;
    // the rest intentionally have none (for "assets without depreciation" queries).
    const shouldDepreciate = status !== 'DISPOSED' && Math.random() < 0.75;
    if (shouldDepreciate) {
      const usefulLifeMonths = category.USEFUL_LIFE * 12;
      const monthlyDepr = round2(cost / usefulLifeMonths);
      const acquisitionDate = new Date(acquisitionDt);
      const monthsElapsed = Math.min(
        usefulLifeMonths,
        Math.max(1, Math.floor((Date.now() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      );
      const periodsToCreate = Math.min(monthsElapsed, 6); // last up to 6 periods, keeps demo data compact

      let accum = 0;
      for (let p = 0; p < periodsToCreate; p++) {
        accum = round2(accum + monthlyDepr);
        const periodDate = new Date(acquisitionDate);
        periodDate.setMonth(periodDate.getMonth() + monthsElapsed - periodsToCreate + p + 1);

        depreciation.push({
          DEPR_ID: deprIdCounter++,
          ASSET_ID: assetId,
          FISCAL_YEAR: periodDate.getFullYear(),
          PERIOD: periodDate.getMonth() + 1,
          DEPR_AMOUNT: monthlyDepr,
          ACCUM_DEPR: accum,
          NET_BOOK_VALUE: round2(Math.max(0, cost - accum)),
        });
      }
    }
  }

  return { assets, depreciation };
}

const { assets, depreciation } = generateAssets(60);

module.exports = {
  PS_BU_TBL: businessUnits,
  PS_LOCATION_TBL: locations,
  PS_CATEGORY_TBL: categories,
  PS_ASSET: assets,
  PS_DEPRECIATION: depreciation,
};
