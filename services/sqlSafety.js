/**
 * Simple, dependency-free SQL classification.
 *
 * Design note: the Impact Analyzer page deliberately does NOT block any
 * statement type — it runs whatever you paste (SELECT, INSERT, UPDATE,
 * DELETE, even DDL) but always inside a transaction that gets rolled back
 * at the end, so nothing is ever permanently changed. The risk labels here
 * are purely informational, to help you understand what a statement WOULD
 * do if it were run for real.
 *
 * The SQL Generator page is stricter: it only ever accepts a single SELECT
 * statement, since that's the only thing the AI is asked to produce.
 */

const FORBIDDEN_KEYWORDS_FOR_GENERATOR = [
  'DELETE', 'UPDATE', 'INSERT', 'DROP', 'ALTER',
  'TRUNCATE', 'MERGE', 'CREATE', 'GRANT', 'REVOKE',
];

const RISK_BY_KEYWORD = {
  SELECT: 'LOW',
  INSERT: 'MEDIUM',
  UPDATE: 'MEDIUM',
  DELETE: 'MEDIUM',
  DROP: 'HIGH',
  ALTER: 'HIGH',
  TRUNCATE: 'HIGH',
  CREATE: 'HIGH',
  GRANT: 'HIGH',
  REVOKE: 'HIGH',
};

/**
 * Splits a block of text into individual statements on `;`, trimming and
 * dropping any empty ones. Good enough for a demo tool — it doesn't try to
 * handle semicolons inside string literals.
 */
function splitStatements(sqlBlock) {
  return sqlBlock
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Classifies a single SQL statement by its leading keyword.
 */
function classifyStatement(sql) {
  const trimmed = sql.trim();
  const match = trimmed.match(/^([a-zA-Z]+)/);
  const keyword = match ? match[1].toUpperCase() : 'UNKNOWN';

  return {
    keyword,
    riskLevel: RISK_BY_KEYWORD[keyword] || 'UNKNOWN',
    isSelect: keyword === 'SELECT',
  };
}

/**
 * Validates that a SQL string is exactly one safe, read-only SELECT
 * statement. Used to gate what the SQL Generator page will actually
 * execute for real (as opposed to the Impact Analyzer, which is always
 * rolled back regardless of statement type).
 */
function validateForGeneration(sql) {
  const trimmed = (sql || '').trim().replace(/;\s*$/, '');

  if (!trimmed) {
    return { isSafe: false, reason: 'Empty SQL statement.' };
  }

  if (trimmed.includes(';')) {
    return { isSafe: false, reason: 'Multiple statements are not allowed here — only a single SELECT.' };
  }

  for (const keyword of FORBIDDEN_KEYWORDS_FOR_GENERATOR) {
    const pattern = new RegExp(`(^|\\W)${keyword}(\\W|$)`, 'i');
    if (pattern.test(trimmed)) {
      return {
        isSafe: false,
        reason: `Contains forbidden keyword "${keyword}". Only read-only SELECT statements are allowed on this page.`,
      };
    }
  }

  if (!/^select\b/i.test(trimmed)) {
    return { isSafe: false, reason: 'Only SELECT statements are allowed on this page.' };
  }

  return { isSafe: true };
}

module.exports = { splitStatements, classifyStatement, validateForGeneration };
