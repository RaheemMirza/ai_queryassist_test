const savedListEl = document.getElementById('saved-list');
const searchInput = document.getElementById('search-input');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let currentQueries = [];

async function loadSavedQueries(search) {
  const url = search ? `/api/saved-queries?search=${encodeURIComponent(search)}` : '/api/saved-queries';
  const res = await fetch(url);
  const body = await res.json();
  currentQueries = body.data || [];
  renderList(currentQueries);
}

function renderList(queries) {
  if (queries.length === 0) {
    savedListEl.innerHTML = `
      <div class="card">
        <div class="empty-state">No saved queries yet. Save one from the SQL Generator page using the "Save query" button.</div>
      </div>
    `;
    return;
  }

  savedListEl.innerHTML = queries
    .map(
      (q) => `
    <div class="card">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:600; font-size:14px;">${escapeHtml(q.name)}</div>
          <div class="text-muted">Saved ${new Date(q.createdAt).toLocaleString()}</div>
        </div>
        <div class="btn-row" style="margin-top:0;">
          <button class="btn btn-secondary btn-rename" data-id="${q.id}">Rename</button>
          <button class="btn btn-secondary btn-copy" data-id="${q.id}">Copy</button>
          <button class="btn btn-secondary btn-delete" data-id="${q.id}">Delete</button>
        </div>
      </div>
      <div class="sql-block" style="margin-top:12px;">${escapeHtml(q.sql)}</div>
    </div>
  `
    )
    .join('');

  savedListEl.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const query = currentQueries.find((q) => q.id === btn.dataset.id);
      if (query) navigator.clipboard.writeText(query.sql);
    });
  });

  savedListEl.querySelectorAll('.btn-rename').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const query = currentQueries.find((q) => q.id === btn.dataset.id);
      if (!query) return;
      const newName = window.prompt('Rename query:', query.name);
      if (!newName || !newName.trim()) return;
      await fetch(`/api/saved-queries/${query.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      loadSavedQueries(searchInput.value.trim());
    });
  });

  savedListEl.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this saved query? This cannot be undone.')) return;
      await fetch(`/api/saved-queries/${btn.dataset.id}`, { method: 'DELETE' });
      loadSavedQueries(searchInput.value.trim());
    });
  });
}

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadSavedQueries(searchInput.value.trim()), 250);
});

loadSavedQueries();