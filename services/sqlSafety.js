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

function splitStatements(sqlBlock) {
  return sqlBlock
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

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

module.exports = { splitStatements, classifyStatement };