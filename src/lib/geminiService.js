// src/services/geminiService.js
// ─────────────────────────────────────────────────────────────
// All Gemini API logic lives here.
// The UI layer should never build prompts or touch the API URL
// directly — that belongs here.
//
// Supports:
//   • buildFinancialContext()  — formats app state into context
//   • askGemini()              — single-turn request (Promise)
//   • streamGemini()           — streaming request (AsyncGenerator)
// ─────────────────────────────────────────────────────────────

const GEMINI_MODEL  = 'gemini-2.5-flash';
const BASE_URL      = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─────────────────────────────────────────────────────────────
// Context builder
// Converts live app state into a compact, structured string
// that the LLM can reason about without hallucinating numbers.
// ─────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {number}   params.balance
 * @param {number}   params.totalDeposited
 * @param {number}   params.totalWithdrawn
 * @param {number}   params.monthNetChange  – positive = saved, negative = spent
 * @param {string}   params.currencySymbol
 * @param {Array}    params.goals           – rows from goal_progress view
 * @param {Array}    params.recentTx        – last 10 transactions
 * @returns {string}
 */
export function buildFinancialContext({
  balance,
  totalDeposited,
  totalWithdrawn,
  monthNetChange,
  currencySymbol = '₱',
  goals = [],
  recentTx = [],
}) {
  const fmt = (n) =>
    currencySymbol +
    Number(n).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const goalLines = goals.length
    ? goals
        .map((g) => {
          const pct = Number(g.progress_percent ?? 0).toFixed(1);
          const datePart = g.target_date ? `, due ${g.target_date}` : '';
          return `  • ${g.name}: ${fmt(g.saved_amount)} / ${fmt(g.target_amount)} (${pct}%${datePart})`;
        })
        .join('\n')
    : '  (no goals set)';

  const txLines = recentTx.length
    ? recentTx
        .slice(0, 10)
        .map((t) => {
          const sign = t.type === 'deposit' ? '+' : '-';
          const note = t.note ? ` — ${t.note}` : '';
          const goal = t.goals?.name ? ` [${t.goals.name}]` : '';
          return `  • ${t.date}  ${sign}${fmt(t.amount)}  ${t.category}${goal}${note}`;
        })
        .join('\n')
    : '  (no transactions logged yet)';

  return `
=== SPROUT FINANCIAL SNAPSHOT ===
Current balance    : ${fmt(balance)}
Total deposited    : ${fmt(totalDeposited)}
Total withdrawn    : ${fmt(totalWithdrawn)}
This month net     : ${monthNetChange >= 0 ? '+' : ''}${fmt(monthNetChange)}

--- Savings Goals ---
${goalLines}

--- Recent Transactions (newest first) ---
${txLines}
=================================`.trim();
}

// ─────────────────────────────────────────────────────────────
// System prompt
// Defines Sprout's persona, guardrails, and response style.
// ─────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `
You are Sprout, a friendly and knowledgeable personal savings assistant 
embedded in the user's savings tracker app.

RULES:
1. Base every numerical answer strictly on the financial snapshot provided.
   Never invent or estimate figures not in the context.
2. Be concise. Aim for 2-4 sentences unless a detailed breakdown is asked for.
3. Format currency values the same way they appear in the snapshot.
4. When the user asks a question whose answer isn't in the context 
   (e.g. stock prices), say so clearly rather than guessing.
5. Be encouraging and supportive, but do not give licensed financial advice.
6. If the snapshot shows no data, invite the user to log their first transaction.
7. When the answer involves a list, use short bullet points.
8. When users have issues regarding the web application, encourage users to contact admin via lanceizah3@gmail.com or +63 9618845757. Use bullet points.
9. Use Bold when highlighting/emphasizing information.
`.trim();

// ─────────────────────────────────────────────────────────────
// Single-turn request (resolves to a full reply string)
// ─────────────────────────────────────────────────────────────

/**
 * @param {string}   apiKey   – user's Gemini API key
 * @param {string}   userMessage
 * @param {string}   financialContext – output of buildFinancialContext()
 * @param {Array}    history  – [{role:'user'|'model', parts:[{text}]}]
 * @returns {Promise<string>}
 */
export async function askGemini(apiKey, userMessage, financialContext, history = []) {
  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Inject the context as the very first user turn so the model always
  // has it, regardless of conversation length.
  const contextTurn = {
    role: 'user',
    parts: [{ text: `Here is my current financial data:\n\n${financialContext}` }],
  };
  const contextAck = {
    role: 'model',
    parts: [{ text: "Got it — I have your financial snapshot. What would you like to know?" }],
  };

  const contents = [
    contextTurn,
    contextAck,
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    generationConfig: {
      temperature:     0.4,   // low temp = factual & consistent
      topP:            0.9,
      maxOutputTokens: 512,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new GeminiError(
      err?.error?.message ?? `HTTP ${res.status}`,
      err?.error?.code ?? res.status
    );
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new GeminiError(
      reason === 'SAFETY'
        ? 'The response was blocked by Gemini\'s safety filters. Please rephrase your question.'
        : 'Gemini returned an empty response. Try again.',
      reason ?? 'EMPTY_RESPONSE'
    );
  }

  return text.trim();
}

// ─────────────────────────────────────────────────────────────
// Streaming request (yields text chunks as they arrive)
// Use this in AIChat.jsx for a typewriter effect.
// ─────────────────────────────────────────────────────────────

/**
 * AsyncGenerator — yields string chunks from the streaming API.
 *
 * Usage in a component:
 *   for await (const chunk of streamGemini(key, msg, ctx, history)) {
 *     setReply(prev => prev + chunk);
 *   }
 *
 * @param {string}   apiKey
 * @param {string}   userMessage
 * @param {string}   financialContext
 * @param {Array}    history
 * @yields {string}
 */
export async function* streamGemini(apiKey, userMessage, financialContext, history = []) {
  const url = `${BASE_URL}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const contextTurn = {
    role: 'user',
    parts: [{ text: `Here is my current financial data:\n\n${financialContext}` }],
  };
  const contextAck = {
    role: 'model',
    parts: [{ text: "Got it — I have your financial snapshot. What would you like to know?" }],
  };

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      contextTurn,
      contextAck,
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      temperature:     0.4,
      topP:            0.9,
      maxOutputTokens: 512,
    },
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new GeminiError(err?.error?.message ?? `HTTP ${res.status}`, res.status);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') return;

      try {
        const parsed = JSON.parse(json);
        const chunk  = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (chunk) yield chunk;
      } catch {
        // malformed SSE chunk — skip
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Custom error class
// ─────────────────────────────────────────────────────────────
export class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}
