const Anthropic = require('@anthropic-ai/sdk');
const { buildSchemaContext } = require('./schemaContext');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.AI_MODEL || 'claude-sonnet-4-5';

// The prompt lives here, separate from the request-handling logic, so it's
// easy to find and tune without touching any route code.
const SYSTEM_PROMPT = `You are an expert PeopleSoft Asset Management (AM) database analyst.
You translate plain-English questions into a single, safe, read-only SQL
SELECT statement that runs against the schema described below.

Rules you must always follow:
- Only ever produce a single SELECT statement. Never produce INSERT, UPDATE,
  DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, or REVOKE statements.
- Never chain multiple statements with semicolons.
- Use explicit JOINs with clear ON conditions rather than comma joins.
- Only reference tables and columns that exist in the schema provided.
- This is a SQLite database — use SQLite-compatible syntax and date functions
  (date(), strftime(), etc.).
- If the request is ambiguous, make a reasonable assumption and say so.
- Respond ONLY with a single JSON object — no markdown fences, no prose
  before or after — matching exactly this shape:

{
  "sql": "SELECT ...",
  "explanation": "Plain-English explanation of what the query does, which tables/joins are used and why, and what the output means.",
  "confidenceScore": 0.0-1.0,
  "tablesInvolved": ["Table1", "Table2"],
  "assumptions": ["Any assumptions made, if applicable"]
}`;

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

/**
 * Asks the AI to generate SQL for a natural-language question, grounded in
 * the current database schema.
 */
async function generateSql(userPrompt) {
  const schemaContext = buildSchemaContext();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `SCHEMA:\n${schemaContext}\n\nQUESTION:\n"${userPrompt}"\n\nRespond with the JSON object described in your instructions now.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('The AI returned no text content.');
  }

  const parsed = extractJson(textBlock.text);

  return {
    sql: (parsed.sql || '').trim(),
    explanation: parsed.explanation || '',
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
    tablesInvolved: parsed.tablesInvolved || [],
    assumptions: parsed.assumptions || [],
  };
}

module.exports = { generateSql };
