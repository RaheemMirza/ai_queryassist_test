const conversationListEl = document.getElementById('conversation-list');
const conversationDetailEl = document.getElementById('conversation-detail');

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadConversations() {
  const res = await fetch('/api/history/conversations');
  const body = await res.json();
  renderConversationList(body.data || []);
}

function renderConversationList(conversations) {
  if (conversations.length === 0) {
    conversationListEl.innerHTML = '<div class="empty-state">No conversations yet.</div>';
    return;
  }

  conversationListEl.innerHTML = conversations
    .map(
      (c) => `
    <div class="conversation-list-item" data-id="${c.conversationId}">
      <div style="font-size:13px; font-weight:500;">${escapeHtml(c.firstPrompt)}</div>
      <div class="text-muted" style="margin-top:4px;">${c.messageCount} message(s) · ${new Date(c.lastActivity).toLocaleString()}</div>
    </div>
  `
    )
    .join('');

  conversationListEl.querySelectorAll('.conversation-list-item').forEach((item) => {
    item.addEventListener('click', () => {
      conversationListEl.querySelectorAll('.conversation-list-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      loadConversationDetail(item.dataset.id);
    });
  });
}

async function loadConversationDetail(conversationId) {
  const res = await fetch(`/api/history/conversations/${conversationId}`);
  const body = await res.json();
  renderConversationDetail(body.data || []);
}

function renderConversationDetail(messages) {
  if (messages.length === 0) {
    conversationDetailEl.innerHTML = '<div class="empty-state">No messages found.</div>';
    return;
  }

  conversationDetailEl.innerHTML = messages
    .map((m) => {
      if (m.role === 'user') {
        return `
          <div class="history-entry">
            <div class="text-muted" style="margin-bottom:4px;">You</div>
            <div>${escapeHtml(m.content)}</div>
          </div>
        `;
      }
      if (m.type === 'chat') {
        return `
          <div class="history-entry">
            <div class="text-muted" style="margin-bottom:4px;">Assistant</div>
            <div>${escapeHtml(m.reply)}</div>
          </div>
        `;
      }
      const rowNote =
        m.rowCount !== null && m.rowCount !== undefined
          ? `<div class="text-muted" style="margin-top:6px;">${m.rowCount} row(s) returned at the time</div>`
          : '';
      return `
        <div class="history-entry">
          <div class="text-muted" style="margin-bottom:4px;">Assistant</div>
          <div style="margin-bottom:8px;">${escapeHtml(m.reply)}</div>
          <div class="sql-block">${escapeHtml(m.sql)}</div>
          ${rowNote}
        </div>
      `;
    })
    .join('');
}

loadConversations();