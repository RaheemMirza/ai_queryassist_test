const OpenAI = require('openai');
const { buildSchemaContext } = require('./schemaContext');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.GITHUB_MODELS_TOKEN) {
      throw new Error(
        'GITHUB_MODELS_TOKEN is not set in your .env file. Add it (see .env.example) and restart the server.'
      );
    }
    client = new OpenAI({
      apiKey: process.env.GITHUB_MODELS_TOKEN,
      baseURL: process.env.AI_BASE_URL || 'https://models.github.ai/inference',
    });
  }
  return client;
}

const MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `You are a helpful assistant embedded in a PeopleSoft Asset Management (AM) tool.
You can hold normal conversation AND generate SQL when the user is actually
asking for data.

For every user message, first decide which of these it is:
- A request for data from the Asset Management database (asking about
  assets, costs, depreciation, locations, categories, counts, listings,
  comparisons, etc.) -> respond with "type": "sql"
- Anything else -- greetings, thanks, small talk, questions about how the
  tool works or what data is available, clarifying questions, or requests
  you can't turn into a query -- respond with "type": "chat"

Only produce SQL when the user is clearly asking for data. Do not force a
SQL query out of a message that doesn't need one.

Rules for any SQL you generate:
- Only ever a single, read-only SELECT statement.
- Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, or REVOKE.
- Never chain multiple statements with semicolons.
- Use explicit JOINs with clear ON conditions rather than comma joins.
- Only reference tables and columns that exist in the schema provided below.
- This is a SQLite database -- use SQLite-compatible syntax and date functions.
- If the request is ambiguous, make a reasonable assumption and mention it.

Respond ONLY with a single JSON object -- no markdown fences, no prose before
or after -- matching exactly this shape:

{
  "type": "sql" | "chat",
  "reply": "A short, friendly natural-language response. For type 'chat' this is your full answer. For type 'sql' this is a brief one-line intro, e.g. 'Here's a query for that.'",
  "sql": "SELECT ... -- omit or null when type is 'chat'",
  "explanation": "Detailed explanation of what the query does, which tables/joins are used and why, and what the output means -- omit or null when type is 'chat'",
  "confidenceScore": 0.0-1.0,
  "tablesInvolved": ["Table1"],
  "assumptions": ["Any assumptions made, if applicable"]
}

When type is "chat", set sql/explanation to null and tablesInvolved/assumptions to empty arrays.`;

function extractJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error('The AI returned a response that could not be parsed. Try rephrasing your question.');
  }
}

async function handleUserMessage(userPrompt) {
  const schemaContext = buildSchemaContext();

  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `SCHEMA:\n${schemaContext}\n\nUSER MESSAGE:\n"${userPrompt}"\n\nRespond with the JSON object described in your instructions now.`,
      },
    ],
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('The AI returned no text content.');
  }

  const parsed = extractJson(text);
  const type = parsed.type === 'sql' ? 'sql' : 'chat';

  return {
    type,
    reply: parsed.reply || '',
    sql: type === 'sql' ? (parsed.sql || '').trim() : null,
    explanation: type === 'sql' ? parsed.explanation || '' : null,
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
    tablesInvolved: parsed.tablesInvolved || [],
    assumptions: parsed.assumptions || [],
  };
}

module.exports = { handleUserMessage };