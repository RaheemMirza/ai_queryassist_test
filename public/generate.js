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
const newChatBtn = document.getElementById('new-chat-btn');

const CONVERSATION_STORAGE_KEY = 'psam_conversation_id';
let conversationId = localStorage.getItem(CONVERSATION_STORAGE_KEY);
if (!conversationId) {
  conversationId = crypto.randomUUID();
  localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
}

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

function riskBadgeClass(riskLevel) {
  switch (riskLevel) {
    case 'LOW': return 'badge-low';
    case 'MEDIUM': return 'badge-medium';
    case 'HIGH': return 'badge-high';
    default: return 'badge-unknown';
  }
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

async function loadConversationHistory() {
  try {
    const res = await fetch(`/api/history/conversations/${conversationId}`);
    const body = await res.json();
    const messages = body.data || [];
    if (messages.length === 0) return;

    sampleChipsEl.classList.add('hidden');
    messages.forEach((msg) => {
      if (msg.role === 'user') {
        addUserBubble(msg.content);
      } else if (msg.type === 'chat') {
        addAssistantTextBubble(msg.reply);
      } else if (msg.type === 'sql') {
        addAssistantTextBubble(msg.reply || "Here's the SQL for that:");
        addSqlCard({
          sql: msg.sql,
          explanation: msg.explanation,
          confidenceScore: msg.confidenceScore,
          tablesInvolved: msg.tablesInvolved || [],
          assumptions: [],
          rowEstimate: null,
          execution: null,
        });
      }
    });
  } catch (err) {
    console.error('Failed to load conversation history:', err);
  }
}

newChatBtn.addEventListener('click', () => {
  conversationId = crypto.randomUUID();
  localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  chatThread.innerHTML = '';
  sampleChipsEl.classList.remove('hidden');
  promptInput.focus();
});

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
      body: JSON.stringify({ prompt, conversationId }),
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
      const execution = body.data.execution;
      if (execution && execution.success && !execution.wasRolledBack && execution.columns.length === 1 && execution.rows.length === 1) {
        const value = execution.rows[0][execution.columns[0]];
        replyText += ` The answer is ${value}.`;
      } else if (execution && execution.success && execution.wasRolledBack) {
        replyText += ` (Safe preview only — ${execution.rowsAffected ?? 0} row(s) would be affected. Nothing was permanently changed.)`;
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

  const tablesText = (data.tablesInvolved || []).join(', ') || '—';

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  meta.innerHTML = `<span>Tables: <strong>${escapeHtml(tablesText)}</strong></span>`;
  card.appendChild(meta);

  const textarea = document.createElement('textarea');
  textarea.className = 'sql-input';
  textarea.rows = 5;
  textarea.value = data.sql || '';
  card.appendChild(textarea);

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

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-secondary';
  saveBtn.textContent = 'Save query';

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
      const res = await fetch('/api/run-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: textarea.value }),
      });
      const body = await res.json();
      if (!body.success) {
        resultsContainer.innerHTML = `<div class="callout callout-danger">${escapeHtml(body.error)}</div>`;
      } else {
        renderExecutionInto(resultsContainer, body.data);
      }
    } catch (err) {
      resultsContainer.innerHTML = `<div class="callout callout-danger">Request failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      runBtn.disabled = false;
      runSpinner.classList.add('hidden');
      scrollToBottom();
    }
  });

  saveBtn.addEventListener('click', async () => {
    const name = window.prompt('Name this query:');
    if (!name || !name.trim()) return;
    try {
      const res = await fetch('/api/saved-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sql: textarea.value }),
      });
      const body = await res.json();
      if (body.success) {
        const original = saveBtn.textContent;
        saveBtn.textContent = 'Saved ✓';
        setTimeout(() => {
          saveBtn.textContent = original;
        }, 1500);
      } else {
        alert(body.error || 'Failed to save query.');
      }
    } catch (err) {
      alert('Failed to save query: ' + err.message);
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
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(copyBtn);
  btnRow.appendChild(downloadBtn);
  card.appendChild(btnRow);
  card.appendChild(resultsContainer);

  if (data.execution) {
    renderExecutionInto(resultsContainer, data.execution);
  } else {
    resultsContainer.innerHTML = '<div class="empty-state">Click "Run query" to see results.</div>';
  }

  chatThread.appendChild(card);
  scrollToBottom();
}

function renderExecutionInto(container, execution) {
  if (!execution.success) {
    container.innerHTML = `<div class="callout callout-danger">${escapeHtml(execution.error)}</div>`;
    return;
  }

  if (execution.wasRolledBack) {
    container.innerHTML = `
      <div class="callout callout-warning">
        <span class="badge ${riskBadgeClass(execution.riskLevel)}" style="margin-right:8px;">${escapeHtml(execution.keyword)}</span>
        This ran in a safe preview inside a transaction that was rolled back — nothing was permanently changed.
        <strong>${execution.rowsAffected ?? 0}</strong> row(s) would be affected.
      </div>
      <div class="text-muted" style="margin-top:8px;">${execution.executionTimeMs}ms</div>
    `;
    return;
  }

  if (execution.rows.length === 0) {
    container.innerHTML = '<div class="empty-state">No rows returned.</div>';
    return;
  }

  if (execution.columns.length === 1 && execution.rows.length === 1) {
    const value = execution.rows[0][execution.columns[0]];
    container.innerHTML = `
      <div class="scalar-answer">
        <span class="scalar-value">${escapeHtml(value)}</span>
        <span class="scalar-label">${escapeHtml(execution.columns[0])}</span>
      </div>
      <div class="result-meta" style="margin-top:8px;"><span>${execution.executionTimeMs}ms</span></div>
    `;
    return;
  }

  const headerHtml = execution.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const rowsHtml = execution.rows
    .map((row) => `<tr>${execution.columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`)
    .join('');
  container.innerHTML = `
    <div class="result-meta"><span><strong>${execution.rowCount}</strong> row(s)</span><span><strong>${execution.executionTimeMs}ms</strong></span></div>
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

loadConversationHistory();