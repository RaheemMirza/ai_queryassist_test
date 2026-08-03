const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'appData.json');

let store = { conversations: {}, savedQueries: [] };

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function load() {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      store = {
        conversations: parsed.conversations || {},
        savedQueries: parsed.savedQueries || [],
      };
    } catch (err) {
      console.error('Could not read data/appData.json, starting fresh:', err.message);
      store = { conversations: {}, savedQueries: [] };
    }
  } else {
    persist();
  }
}

function persist() {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function addMessage(conversationId, message) {
  if (!store.conversations[conversationId]) {
    store.conversations[conversationId] = { createdAt: new Date().toISOString(), messages: [] };
  }
  store.conversations[conversationId].messages.push({
    ...message,
    createdAt: new Date().toISOString(),
  });
  persist();
}

function listConversations() {
  return Object.entries(store.conversations)
    .map(([conversationId, convo]) => {
      const firstUserMessage = convo.messages.find((m) => m.role === 'user');
      const lastMessage = convo.messages[convo.messages.length - 1];
      return {
        conversationId,
        firstPrompt: firstUserMessage ? firstUserMessage.content : '(empty conversation)',
        messageCount: convo.messages.length,
        lastActivity: lastMessage ? lastMessage.createdAt : convo.createdAt,
      };
    })
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}

function getConversation(conversationId) {
  return store.conversations[conversationId] ? store.conversations[conversationId].messages : [];
}

function deleteConversation(conversationId) {
  delete store.conversations[conversationId];
  persist();
}

function saveQuery({ name, sql, description }) {
  const query = {
    id: crypto.randomUUID(),
    name,
    sql,
    description: description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.savedQueries.push(query);
  persist();
  return query;
}

function listSavedQueries(search) {
  let list = store.savedQueries;
  if (search) {
    const needle = search.toLowerCase();
    list = list.filter(
      (q) =>
        q.name.toLowerCase().includes(needle) ||
        q.sql.toLowerCase().includes(needle) ||
        (q.description || '').toLowerCase().includes(needle)
    );
  }
  return [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renameSavedQuery(id, name) {
  const query = store.savedQueries.find((q) => q.id === id);
  if (!query) return null;
  query.name = name;
  query.updatedAt = new Date().toISOString();
  persist();
  return query;
}

function deleteSavedQuery(id) {
  store.savedQueries = store.savedQueries.filter((q) => q.id !== id);
  persist();
}

load();

module.exports = {
  addMessage,
  listConversations,
  getConversation,
  deleteConversation,
  saveQuery,
  listSavedQueries,
  renameSavedQuery,
  deleteSavedQuery,
};