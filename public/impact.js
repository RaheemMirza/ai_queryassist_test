const sqlInput = document.getElementById('sql-input');
const analyzeBtn = document.getElementById('analyze-btn');
const analyzeSpinner = document.getElementById('analyze-spinner');
const clearBtn = document.getElementById('clear-btn');
const analysisResult = document.getElementById('analysis-result');

function escapeHtml(value) {
  if (value === null || value === undefined) return '<span class="text-muted">—</span>';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function riskBadgeClass(riskLevel) {
  switch (riskLevel) {
    case 'LOW': return 'badge-low';
    case 'MEDIUM': return 'badge-medium';
    case 'HIGH': return 'badge-high';
    default: return 'badge-unknown';
  }
}

async function handleAnalyze() {
  const sql = sqlInput.value.trim();
  if (!sql) return;

  analyzeBtn.disabled = true;
  analyzeSpinner.classList.remove('hidden');
  analysisResult.innerHTML = '';

  try {
    const res = await fetch('/api/analyze-impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const body = await res.json();

    if (!body.success) {
      analysisResult.innerHTML = `<div class="callout callout-danger">${escapeHtml(body.error)}</div>`;
      return;
    }

    renderAnalysis(body.data);
  } catch (err) {
    analysisResult.innerHTML = `<div class="callout callout-danger">Request failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeSpinner.classList.add('hidden');
  }
}

function renderAnalysis(data) {
  const summary = `
    <div class="callout callout-success" style="margin-bottom:20px;">
      Analyzed <strong>${data.statementsAnalyzed}</strong> statement(s). ${escapeHtml(data.note)}
    </div>
  `;

  const cards = data.results.map(renderStatementCard).join('');
  analysisResult.innerHTML = summary + cards;
}

function renderStatementCard(entry, index) {
  const statusBadge = entry.success
    ? '<span class="badge badge-success">Ran successfully</span>'
    : '<span class="badge badge-error">Failed</span>';

  let impactLine;
  if (!entry.success) {
    impactLine = `<div class="callout callout-danger">${escapeHtml(entry.error)}</div>`;
  } else if (entry.keyword === 'SELECT') {
    impactLine = `<div class="result-meta"><span><strong>${entry.rowsReturned}</strong> row(s) would be returned</span><span>${entry.executionTimeMs}ms</span></div>`;
  } else {
    impactLine = `<div class="result-meta"><span><strong>${entry.rowsAffected ?? 0}</strong> row(s) would be affected</span><span>${entry.executionTimeMs}ms</span></div>`;
  }

  let previewHtml = '';
  if (entry.success && entry.keyword === 'SELECT' && entry.previewRows.length > 0) {
    const headerHtml = entry.previewColumns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
    const rowsHtml = entry.previewRows
      .map((row) => `<tr>${entry.previewColumns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`)
      .join('');
    const truncatedNote = entry.truncatedPreview
      ? `<p class="text-muted" style="margin-top:8px;">Showing first ${entry.previewRows.length} of ${entry.rowsReturned} rows.</p>`
      : '';

    previewHtml = `
      <div class="table-wrap" style="margin-top:12px;">
        <table class="results-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${truncatedNote}
    `;
  }

  return `
    <div class="statement-card">
      <div class="statement-card-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge ${riskBadgeClass(entry.riskLevel)}">${escapeHtml(entry.keyword)}</span>
          <span class="badge badge-unknown" style="text-transform:none;">Risk: ${escapeHtml(entry.riskLevel)}</span>
          ${statusBadge}
        </div>
        <span class="text-muted">Statement ${index + 1}</span>
      </div>
      <div class="statement-card-body">
        <div class="sql-block">${escapeHtml(entry.sql)}</div>
        ${impactLine}
        ${previewHtml}
      </div>
    </div>
  `;
}

analyzeBtn.addEventListener('click', handleAnalyze);
clearBtn.addEventListener('click', () => {
  sqlInput.value = '';
  analysisResult.innerHTML = '';
});
sqlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnalyze();
});
