const SAMPLE_PROMPTS = [
  'Show all active assets purchased after January 2025',
  'Show disposed assets this month',
  'Find assets without depreciation',
  'List assets costing more than 20000',
  'Show assets located in Hyderabad',
];

const promptInput = document.getElementById('prompt-input');
const chatForm = document.getElementById('chat-form');
const askBtn = document.getElementById('ask-btn');
const askSpinner = document.getElementById('ask-spinner');
const chatThread = document.getElementById('chat-thread');
const sampleChipsEl = document.getElementById('sample-chips');

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

function scrollToBottom() {
  chatThread.scrollTop = chatThread.scrollHeight;
}

function addUserBubble(text) {
  const bubble = document.createElement('div');
  bubble.className = 'msg msg-user';
  bubble.textContent = text;
  chatThread.appendChild(bubble);
  scrollToBottom();
}

function addAssistantTextBubble(text) {
  const bubble = document.createElement('div');
  bubble.className = 'msg msg-assistant-text';
  bubble.textContent = text;
  chatThread.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function addLoadingBubble() {
  const bubble = document.createElement('div');
  bubble.className = 'msg msg-assistant-text msg-loading';
  bubble.innerHTML = '<span class="spinner spinner-dark"></span> Thinking…';
  chatThread.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

async function handleAsk(e) {
  e.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  sampleChipsEl.classList.add('hidden');
  addUserBubble(prompt);
  promptInput.value = '';
  promptInput.style.height = 'auto';

  askBtn.disabled = true;
  askSpinner.classList.remove('hidden');
  const loadingBubble = addLoadingBubble();

  try {
    const res = await fetch('/api/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const body = await res.json();
    loadingBubble.remove();

    if (!body.success) {
      addAssistantTextBubble(body.error || 'Something went wrong.');
      return;
    }

    if (body.data.type === 'chat') {
      addAssistantTextBubble(body.data.reply);
    } else {
      let replyText = body.data.reply || "Here's the SQL for that:";
      const results = body.data.results;
      if (results && results.columns.length === 1 && results.rows.length === 1) {
        const value = results.rows[0][results.columns[0]];
        replyText += ` The answer is ${value}.`;
      }
      addAssistantTextBubble(replyText);
      addSqlCard(body.data);
    }
  } catch (err) {
    loadingBubble.remove();
    addAssistantTextBubble('Request failed: ' + err.message);
  } finally {
    askBtn.disabled = false;
    askSpinner.classList.add('hidden');
  }
}

function addSqlCard(data) {
  const card = document.createElement('div');
  card.className = 'card sql-response-card';

  const confidencePct = Math.round((data.confidenceScore || 0) * 100);
const tablesText = (data.tablesInvolved || []).join(', ') || '—';

const meta = document.createElement('div');
meta.className = 'result-meta';
// Confidence display disabled for now — re-enable by uncommenting the
// "Confidence" span below if it's useful again later.
meta.innerHTML = `<span>Tables: <strong>${escapeHtml(tablesText)}</strong></span>`;
/* meta.innerHTML = `<span>Confidence: <strong>${confidencePct}%</strong></span><span>Tables: <strong>${escapeHtml(tablesText)}</strong></span>`; */
card.appendChild(meta);

  const textarea = document.createElement('textarea');
  textarea.className = 'sql-input';
  textarea.rows = 5;
  textarea.value = data.sql || '';
  card.appendChild(textarea);

  if (!data.safety.isSafe) {
    const callout = document.createElement('div');
    callout.className = 'callout callout-danger';
    callout.textContent = data.safety.reason;
    card.appendChild(callout);
  }

  if (data.rowEstimate !== null && data.rowEstimate !== undefined) {
    const callout = document.createElement('div');
    callout.className = 'callout callout-info';
    callout.innerHTML = `Estimated rows: <strong>${Number(data.rowEstimate).toLocaleString()}</strong>`;
    card.appendChild(callout);
  }

  if (data.assumptions && data.assumptions.length) {
    const p = document.createElement('p');
    p.className = 'text-muted';
    p.style.marginTop = '12px';
    p.textContent = 'Assumptions: ' + data.assumptions.join(' · ');
    card.appendChild(p);
  }

  if (data.explanation) {
    const p = document.createElement('p');
    p.style.marginTop = '14px';
    p.style.fontSize = '14px';
    p.style.color = '#374151';
    p.style.lineHeight = '1.6';
    p.textContent = data.explanation;
    card.appendChild(p);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn btn-primary';
  const runSpinner = document.createElement('span');
  runSpinner.className = 'spinner hidden';
  runBtn.appendChild(runSpinner);
  runBtn.appendChild(document.createTextNode(' Run query'));
  if (!data.safety.isSafe) runBtn.disabled = true;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-secondary';
  copyBtn.textContent = 'Copy SQL';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn btn-secondary';
  downloadBtn.textContent = 'Download .sql';

  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'sql-card-results';

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runSpinner.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    try {
      const res = await fetch('/api/run-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: textarea.value }),
      });
      const body = await res.json();
      if (!body.success) {
        resultsContainer.innerHTML = `<div class="callout callout-danger">${escapeHtml(body.error)}</div>`;
      } else {
        renderResultsInto(resultsContainer, body.data);
      }
    } catch (err) {
      resultsContainer.innerHTML = `<div class="callout callout-danger">Request failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      runBtn.disabled = false;
      runSpinner.classList.add('hidden');
      scrollToBottom();
    }
  });

  copyBtn.addEventListener('click', () => navigator.clipboard.writeText(textarea.value));
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([textarea.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    a.click();
    URL.revokeObjectURL(url);
  });

  btnRow.appendChild(runBtn);
  btnRow.appendChild(copyBtn);
  btnRow.appendChild(downloadBtn);
  card.appendChild(btnRow);
  card.appendChild(resultsContainer);

  if (data.results) {
    renderResultsInto(resultsContainer, data.results);
  } else if (data.safety.isSafe) {
    resultsContainer.innerHTML = '<div class="empty-state">Click "Run query" to see results.</div>';
  }

  chatThread.appendChild(card);
  scrollToBottom();
}

function renderResultsInto(container, { columns, rows, rowCount, executionTimeMs }) {
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty-state">No rows returned.</div>';
    return;
  }

  if (columns.length === 1 && rows.length === 1) {
    const value = rows[0][columns[0]];
    container.innerHTML = `
      <div class="scalar-answer">
        <span class="scalar-value">${escapeHtml(value)}</span>
        <span class="scalar-label">${escapeHtml(columns[0])}</span>
      </div>
      <div class="result-meta" style="margin-top:8px;"><span>${executionTimeMs}ms</span></div>
    `;
    return;
  }

  const headerHtml = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const rowsHtml = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`)
    .join('');
  container.innerHTML = `
    <div class="result-meta"><span><strong>${rowCount}</strong> row(s)</span><span><strong>${executionTimeMs}ms</strong></span></div>
    <div class="table-wrap"><table class="results-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
  `;
}

chatForm.addEventListener('submit', handleAsk);

promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleAsk(e);
  }
});

promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + 'px';
});