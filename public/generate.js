const SAMPLE_PROMPTS = [
  'Show all active assets purchased after January 2025',
  'Show disposed assets this month',
  'Find assets without depreciation',
  'List assets costing more than 20000',
  'Show assets located in Hyderabad',
];

const promptInput = document.getElementById('prompt-input');
const askBtn = document.getElementById('ask-btn');
const askSpinner = document.getElementById('ask-spinner');
const generationResult = document.getElementById('generation-result');
const executionResult = document.getElementById('execution-result');
const sampleChipsEl = document.getElementById('sample-chips');

let lastEditedSql = '';

// Render sample prompt chips
SAMPLE_PROMPTS.forEach((prompt) => {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = prompt;
  chip.addEventListener('click', () => {
    promptInput.value = prompt;
    promptInput.focus();
  });
  sampleChipsEl.appendChild(chip);
});

function escapeHtml(value) {
  if (value === null || value === undefined) return '<span class="text-muted">—</span>';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function handleAsk() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  askBtn.disabled = true;
  askSpinner.classList.remove('hidden');
  generationResult.innerHTML = '';
  executionResult.innerHTML = '';

  try {
    const res = await fetch('/api/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const body = await res.json();

    if (!body.success) {
      generationResult.innerHTML = `<div class="callout callout-danger">${escapeHtml(body.error)}</div>`;
      return;
    }

    renderGenerationResult(body.data);
  } catch (err) {
    generationResult.innerHTML = `<div class="callout callout-danger">Request failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    askBtn.disabled = false;
    askSpinner.classList.add('hidden');
  }
}

function renderGenerationResult(data) {
  lastEditedSql = data.sql;

  const confidencePct = Math.round((data.confidenceScore || 0) * 100);
  const tablesText = (data.tablesInvolved || []).join(', ') || '—';

  const safetyCallout = data.safety.isSafe
    ? ''
    : `<div class="callout callout-danger">${escapeHtml(data.safety.reason)}</div>`;

  const rowEstimateHtml =
    data.rowEstimate !== null && data.rowEstimate !== undefined
      ? `<div class="callout callout-info">Estimated rows: <strong>${data.rowEstimate.toLocaleString()}</strong></div>`
      : '';

  const assumptionsHtml =
    data.assumptions && data.assumptions.length
      ? `<p class="text-muted" style="margin-top:12px;">Assumptions: ${escapeHtml(data.assumptions.join(' · '))}</p>`
      : '';

  generationResult.innerHTML = `
    <div class="card">
      <h2>Generated SQL</h2>
      <div class="result-meta">
        <span>Confidence: <strong>${confidencePct}%</strong></span>
        <span>Tables: <strong>${escapeHtml(tablesText)}</strong></span>
      </div>
      <textarea id="editable-sql" class="sql-input" rows="5"></textarea>
      ${safetyCallout}
      ${rowEstimateHtml}
      ${assumptionsHtml}
      <p style="margin-top:14px; font-size:14px; color:#374151; line-height:1.6;">${escapeHtml(data.explanation)}</p>
      <div class="btn-row">
        <button id="run-btn" class="btn btn-primary" ${data.safety.isSafe ? '' : 'disabled'}>
          <span id="run-spinner" class="spinner hidden"></span>
          Run query
        </button>
        <button id="copy-btn" class="btn btn-secondary">Copy SQL</button>
        <button id="download-btn" class="btn btn-secondary">Download .sql</button>
      </div>
    </div>
  `;

  const editableSql = document.getElementById('editable-sql');
  editableSql.value = data.sql; // set via property to avoid any HTML-escaping artifacts

  document.getElementById('run-btn').addEventListener('click', () => handleRun(editableSql.value));
  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(editableSql.value);
  });
  document.getElementById('download-btn').addEventListener('click', () => {
    const blob = new Blob([editableSql.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function handleRun(sql) {
  const runBtn = document.getElementById('run-btn');
  const runSpinner = document.getElementById('run-spinner');
  runBtn.disabled = true;
  runSpinner.classList.remove('hidden');
  executionResult.innerHTML = '';

  try {
    const res = await fetch('/api/run-select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const body = await res.json();

    if (!body.success) {
      executionResult.innerHTML = `<div class="callout callout-danger">${escapeHtml(body.error)}</div>`;
      return;
    }

    renderResultsTable(body.data);
  } catch (err) {
    executionResult.innerHTML = `<div class="callout callout-danger">Request failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    runBtn.disabled = false;
    runSpinner.classList.add('hidden');
  }
}

function renderResultsTable({ columns, rows, rowCount, executionTimeMs }) {
  if (rows.length === 0) {
    executionResult.innerHTML = `
      <div class="card">
        <h2>Results</h2>
        <div class="empty-state">No rows returned.</div>
      </div>`;
    return;
  }

  const headerHtml = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const rowsHtml = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`)
    .join('');

  executionResult.innerHTML = `
    <div class="card">
      <h2>Results</h2>
      <div class="result-meta">
        <span><strong>${rowCount}</strong> row(s)</span>
        <span><strong>${executionTimeMs}ms</strong></span>
      </div>
      <div class="table-wrap">
        <table class="results-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

askBtn.addEventListener('click', handleAsk);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAsk();
});
