const OpenAI = require('openai');
const { buildSchemaContext } = require('./schemaContext');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.AI_API_KEY) {
      throw new Error(
        'AI_API_KEY is not set in your .env file. Add it (see .env.example) and restart the server.'
      );
    }
    client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
    });
  }
  return client;
}

const MODEL = process.env.AI_MODEL || 'openai/gpt-oss-20b';

const SYSTEM_PROMPT = `You write SQLite SQL for a PeopleSoft Asset Management demo, or just chat.

If the user is asking about or changing data, reply with SQL. Otherwise just chat.

SQL rules: exactly one statement, no chained statements, only use tables/columns/values shown below, SQLite syntax. Any SQL type is fine (SELECT, INSERT, UPDATE, DELETE, etc.) -- non-SELECT statements always run in a rolled-back preview, never permanently applied.

Always use the exact real values shown below (same spelling/casing) -- never guess a variant.

Reply with ONLY a JSON object, no markdown, no extra text, no reasoning shown.
The "type" field must be exactly the word "sql" or exactly the word "chat" -- nothing else.
Example for a data question:
{"type":"sql","reply":"Here's a query for that.","sql":"SELECT ...","explanation":"what it does","tablesInvolved":["Table1"]}
Example for ordinary conversation:
{"type":"chat","reply":"Hi! Ask me about your asset data anytime.","sql":null,"explanation":null,"tablesInvolved":[]}`;

function extractJson(text) {
  const attempts = [
    text.trim(),
    text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, ''),
  ];

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) attempts.push(braceMatch[0]);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // try the next attempt
    }
  }

  throw new Error('The AI returned a response that could not be parsed. Try rephrasing your question.');
}

function determineType(parsed) {
  if (parsed.type === 'sql') return 'sql';

  const sqlValue = typeof parsed.sql === 'string' ? parsed.sql.trim() : '';
  const looksLikeRealSql = sqlValue.length > 0 && sqlValue.toLowerCase() !== 'null';

  return looksLikeRealSql ? 'sql' : 'chat';
}

async function handleUserMessage(userPrompt) {
  const schemaContext = buildSchemaContext();

  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nSCHEMA:\n${schemaContext}` },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('The AI returned no text content.');
  }

  const parsed = extractJson(text);
  const type = determineType(parsed);

  return {
    type,
    reply: parsed.reply || '',
    sql: type === 'sql' ? (parsed.sql || '').trim() : null,
    explanation: type === 'sql' ? parsed.explanation || '' : null,
    confidenceScore: 0.7,
    tablesInvolved: parsed.tablesInvolved || [],
    assumptions: [],
  };
}

module.exports = { handleUserMessage };