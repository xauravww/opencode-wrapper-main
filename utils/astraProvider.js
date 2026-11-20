import { Readable, Transform } from 'stream';

// Port of `astra_proxy.py` / `toolproxy.py` (freemodels backend).
// Talks to the free FreeModels upstream directly — no local proxy server needed.

const FREEMODELS_URL = process.env.FREEMODELS_URL || 'https://freemodels-chat.freemodels.workers.dev/';
const FREEMODELS_MODEL = process.env.FREEMODELS_MODEL || 'gpt-6-astra';
const FREEMODELS_TIMEOUT = parseInt(process.env.ASTRA_TIMEOUT_MS || '120000', 10);

const FREEMODELS_HEADERS = {
  'accept': '*/*',
  'content-type': 'application/json',
  'origin': 'https://freeaimodels.online',
  'referer': 'https://freeaimodels.online/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8075.29 Safari/537.36',
};

const NO_COT_HINT =
  'Answer directly and concisely. Do not reveal internal reasoning, ' +
  'chain-of-thought, or <thinking> blocks; return only the final response.';

const TAG_NAMES = ['thinking', 'reasoning', 'analysis', 'scratchpad'];
const TAG_TOKENS = TAG_NAMES.flatMap(n => [`<${n}>`, `</${n}>`]);

// ---------------------------------------------------------------- messages

export function flattenMessages(messages) {
  const flat = [];
  for (const msg of messages) {
    const role = msg && msg.role;
    if (role === 'tool') {
      flat.push({
        role: 'user',
        content: `Tool result (${msg.tool_call_id || 'call'}):\n${msg.content || ''}`,
      });
    } else if (role === 'assistant' && Array.isArray(msg.tool_calls)) {
      const parts = [];
      if (msg.content) parts.push(String(msg.content));
      for (const tc of msg.tool_calls) {
        const fn = (tc && tc.function) || {};
        parts.push(`[called ${fn.name} with arguments ${fn.arguments || '{}'}]`);
      }
      flat.push({ role: 'assistant', content: parts.join('\n') });
    } else {
      flat.push(msg);
    }
  }
  return flat;
}

export function guardMessages(messages) {
  const guarded = messages.map(m => ({ ...m }));
  if (guarded.length && guarded[0].role === 'system') {
    guarded[0].content = `${guarded[0].content || ''}\n\n${NO_COT_HINT}`.trim();
  } else {
    guarded.unshift({ role: 'system', content: NO_COT_HINT });
  }
  return guarded;
}

export function freemodelsPayload(messages, model, stream = false) {
  return {
    messages: guardMessages(flattenMessages(messages)),
    modelId: model || FREEMODELS_MODEL,
    thinking: false,
    deepSearch: false,
    stream,
  };
}

// ---------------------------------------------------------------- reasoning split

function splitTagged(text) {
  const found = [];
  const cleaned = String(text || '').replace(
    new RegExp(`<(${TAG_NAMES.join('|')})>(.*?)</\\1>`, 'gis'),
    (m, name, inner) => {
      found.push(inner.trim());
      return '';
    }
  );
  return [cleaned.trim(), found.filter(Boolean).join('\n\n')];
}

export function splitUpstream(obj) {
  let content = obj.content || '';
  let reasoning = '';
  for (const key of ['reasoning_content', 'reasoning', 'thinking']) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) {
      reasoning = v.trim();
      break;
    }
  }
  let [c, tagged] = splitTagged(content);
  if (tagged) reasoning = reasoning ? `${reasoning}\n\n${tagged}` : tagged;
  return [c, reasoning];
}

class ReasoningStreamFilter {
  constructor() {
    this.buf = '';
    this.inside = null;
  }

  _partialSuffix() {
    const max = Math.min(this.buf.length, 16);
    for (let n = max; n > 0; n--) {
      const suffix = this.buf.slice(-n).toLowerCase();
      if (TAG_TOKENS.some(tok => tok.startsWith(suffix))) return n;
    }
    return 0;
  }

  feed(text) {
    this.buf += text || '';
    const content = [];
    const reasoning = [];
    while (this.buf) {
      if (this.inside) {
        const end = `</${this.inside}>`;
        const idx = this.buf.toLowerCase().indexOf(end);
        if (idx === -1) {
          const keep = this._partialSuffix();
          if (keep) {
            reasoning.push(this.buf.slice(0, -keep));
            this.buf = this.buf.slice(-keep);
          } else {
            reasoning.push(this.buf);
            this.buf = '';
          }
          return [content.join(''), reasoning.join('')];
        }
        reasoning.push(this.buf.slice(0, idx));
        this.buf = this.buf.slice(idx + end.length);
        this.inside = null;
        continue;
      }

      const lower = this.buf.toLowerCase();
      let best = null;
      for (const name of TAG_NAMES) {
        for (const [token, isOpen] of [[`<${name}>`, true], [`</${name}>`, false]]) {
          const idx = lower.indexOf(token);
          if (idx !== -1 && (best === null || idx < best[0])) best = [idx, token, isOpen, name];
        }
      }
      if (best === null) {
        const keep = this._partialSuffix();
        if (keep) {
          content.push(this.buf.slice(0, -keep));
          this.buf = this.buf.slice(-keep);
        } else {
          content.push(this.buf);
          this.buf = '';
        }
        break;
      }
      const [idx, token, isOpen, name] = best;
      content.push(this.buf.slice(0, idx));
      this.buf = this.buf.slice(idx + token.length);
      if (isOpen) this.inside = name;
    }
    return [content.join(''), reasoning.join('')];
  }

  flush() {
    const text = this.buf;
    this.buf = '';
    if (this.inside) return ['', text];
    return [text, ''];
  }
}

// ---------------------------------------------------------------- json / tool-call parsing

function fixJsonControlChars(raw) {
  let out = '';
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inStr = false;
      } else if (ch.charCodeAt(0) < 0x20) {
        out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

function extractJsonValue(raw) {
  const candidates = [];
  const i1 = raw.indexOf('{');
  const i2 = raw.indexOf('[');
  if (i1 !== -1) candidates.push([i1, '{', '}']);
  if (i2 !== -1) candidates.push([i2, '[', ']']);
  if (!candidates.length) return null;
  candidates.sort((a, b) => a[0] - b[0]);
  const [start, opener, closer] = candidates[0];
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === opener) depth++;
      else if (ch === closer) {
        depth--;
        if (depth === 0) return raw.slice(start, i + 1);
      }
    }
  }
  return raw.slice(start);
}

function tryJson(text) {
  text = String(text || '').trim();
  if (!text) return null;
  for (const attempt of [text, fixJsonControlChars(text)]) {
    try {
      return JSON.parse(attempt);
    } catch { /* ignore */ }
  }
  return null;
}

function coerceArgs(args) {
  if (args === null || args === undefined) return {};
  if (typeof args === 'string') {
    const parsed = tryJson(args);
    return parsed === null ? args : parsed;
  }
  return args;
}

const NAME_KEYS = ['tool_name', 'tool', 'function_name', 'recipient_name', 'name'];
const ARG_KEYS = ['arguments', 'parameters', 'args', 'input', 'params'];

function normalizeToolCall(item) {
  if (!item || typeof item !== 'object') return null;

  const fn = item.function;
  if (fn && typeof fn === 'object') {
    const name = fn.name;
    const args = fn.arguments !== undefined ? fn.arguments : (fn.parameters !== undefined ? fn.parameters : {});
    if (typeof name === 'string' && name.trim()) return { name: name.trim(), arguments: coerceArgs(args) };
  } else if (typeof fn === 'string' && fn.trim() && ARG_KEYS.some(k => k in item)) {
    for (const k of ARG_KEYS) {
      if (k in item) return { name: fn.trim(), arguments: coerceArgs(item[k]) };
    }
  }

  if (item.tool_call && typeof item.tool_call === 'object') return normalizeToolCall(item.tool_call);

  let name = null;
  for (const key of NAME_KEYS) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) {
      name = v.trim();
      break;
    }
  }
  if (!name) return null;

  const explicit = 'function' in item || 'tool_name' in item || 'tool' in item;
  let args = null;
  for (const key of ARG_KEYS) {
    if (key in item) {
      args = item[key];
      break;
    }
  }
  if (args === null && !explicit) return null;
  return { name, arguments: coerceArgs(args === null ? {} : args) };
}

export function parseToolCalls(raw) {
  if (!raw || !String(raw).trim()) return [];
  let text = String(raw).trim();
  if (text.startsWith('```')) {
    text = text.split('\n', 1)[1] !== undefined ? text.slice(text.indexOf('\n') + 1) : text;
    const last = text.lastIndexOf('```');
    if (last !== -1) text = text.slice(0, last);
    text = text.trim();
  }

  let parsed = tryJson(text);
  if (parsed === null) {
    const extracted = extractJsonValue(text);
    if (extracted !== null) parsed = tryJson(extracted);
  }
  if (parsed === null) return [];

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const calls = [];
  for (const item of items) {
    if (item && typeof item === 'object' && Array.isArray(item.tool_calls)) {
      for (const sub of item.tool_calls) {
        const n = normalizeToolCall(sub);
        if (n) calls.push(n);
      }
      continue;
    }
    if (item && typeof item === 'object' && Array.isArray(item.tool_call)) {
      for (const sub of item.tool_call) {
        const n = normalizeToolCall(sub);
        if (n) calls.push(n);
      }
      continue;
    }
    const n = normalizeToolCall(item);
    if (n) calls.push(n);
  }
  return calls;
}

function toOpenaiToolCalls(calls) {
  const out = [];
  for (const call of calls) {
    const arg = call.arguments;
    const argsStr = typeof arg === 'string' ? arg : JSON.stringify(arg ?? {});
    out.push({
      id: 'call_' + Math.random().toString(16).slice(2, 14),
      type: 'function',
      function: { name: call.name, arguments: argsStr },
    });
  }
  return out;
}

// ---------------------------------------------------------------- tool prompt

function buildToolPrompt(toolsSchema) {
  const fnList = toolsSchema.map(t => t.function || t);
  const toolDesc = JSON.stringify(fnList, null, 2);
  return (
    'You have access to the following functions:\n\n' +
    `${toolDesc}\n\n` +
    'If you need to call one or more functions, reply with ONLY a JSON value ' +
    '(no markdown, no prose) in this shape:\n' +
    '{"tool_calls": [{"name": "<function name>", "arguments": {<arguments>}}]}\n' +
    'Otherwise reply normally with the final answer.'
  );
}

function injectToolPrompt(messages, toolsSchema) {
  const toolPrompt = buildToolPrompt(toolsSchema);
  const augmented = messages.map(m => ({ ...m }));
  if (augmented.length && augmented[0].role === 'system') {
    augmented[0] = { role: 'system', content: `${augmented[0].content}\n\n${toolPrompt}` };
  } else {
    augmented.unshift({ role: 'system', content: toolPrompt });
  }
  return augmented;
}

// ---------------------------------------------------------------- upstream I/O

async function chatFreemodels(messages, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FREEMODELS_TIMEOUT);
  try {
    const resp = await fetch(FREEMODELS_URL, {
      method: 'POST',
      headers: FREEMODELS_HEADERS,
      body: JSON.stringify(freemodelsPayload(messages, model, false)),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`FreeModels upstream HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    return splitUpstream(data);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- responses

function textResponse(model, content, reasoning = '') {
  const message = { role: 'assistant', content: content || '' };
  if (reasoning) message.reasoning_content = reasoning;
  return {
    id: 'chatcmpl-' + Math.random().toString(16).slice(2, 22),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function toolResponse(model, calls, reasoning = '') {
  const message = { role: 'assistant', content: null, tool_calls: toOpenaiToolCalls(calls) };
  if (reasoning) message.reasoning_content = reasoning;
  return {
    id: 'chatcmpl-' + Math.random().toString(16).slice(2, 22),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: 'tool_calls' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// ---------------------------------------------------------------- streaming

function completionToSse(completion) {
  const base = {
    id: completion.id,
    object: 'chat.completion.chunk',
    created: completion.created,
    model: completion.model,
  };
  const message = completion.choices[0].message;
  const events = [];

  if (message.tool_calls) {
    const first = message.tool_calls.map((c, i) => ({
      index: i,
      id: c.id,
      type: 'function',
      function: { name: c.function.name, arguments: '' },
    }));
    events.push({ ...base, choices: [{ index: 0, delta: { role: 'assistant', tool_calls: first }, finish_reason: null }] });
    message.tool_calls.forEach((c, i) => {
      events.push({
        ...base,
        choices: [{ index: 0, delta: { tool_calls: [{ index: i, function: { arguments: c.function.arguments } }] }, finish_reason: null }],
      });
    });
    events.push({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
  } else {
    if (message.reasoning_content) {
      events.push({ ...base, choices: [{ index: 0, delta: { reasoning_content: message.reasoning_content }, finish_reason: null }] });
    }
    events.push({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: message.content }, finish_reason: null }] });
    events.push({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
  }

  let sse = events.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('');
  sse += 'data: [DONE]\n\n';
  return Readable.from([sse]);
}

// Relay upstream SSE, stripping tagged reasoning. Returns { body, model }.
function streamPassthrough(messages, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FREEMODELS_TIMEOUT);
  const filter = new ReasoningStreamFilter();

  const body = new Readable({
    read() {},
    destroy(err, cb) {
      clearTimeout(timer);
      cb(err);
    },
  });

  (async () => {
    try {
      const resp = await fetch(FREEMODELS_URL, {
        method: 'POST',
        headers: FREEMODELS_HEADERS,
        body: JSON.stringify(freemodelsPayload(messages, model, true)),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`FreeModels upstream stream HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }

      const decoder = new TextDecoder();
      let buf = '';
      for await (const chunk of resp.body) {
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') {
            body.push('data: [DONE]\n\n');
            continue;
          }
          let obj;
          try { obj = JSON.parse(payload); } catch { continue; }
          const choice = (obj.choices || [])[0];
          const delta = (choice && choice.delta) || {};
          const rawContent = delta.content || '';
          const [content, reasoning] = filter.feed(rawContent);
          const rebuilt = { ...obj };
          let didPush = false;
          if (content) {
            rebuilt.choices = [{ index: 0, delta: { content }, finish_reason: null }];
            body.push('data: ' + JSON.stringify(rebuilt) + '\n\n');
            didPush = true;
          }
          if (reasoning) {
            const r = { ...obj, choices: [{ index: 0, delta: { reasoning_content: reasoning }, finish_reason: null }] };
            body.push('data: ' + JSON.stringify(r) + '\n\n');
            didPush = true;
          }
          if (!didPush) {
            // re-emit non-content events (usage, role, finish_reason) untouched
            body.push('data: ' + JSON.stringify(rebuilt) + '\n\n');
          }
        }
      }
      buf += decoder.decode();
      const last = buf.trim();
      if (last.startsWith('data:')) {
        const payload = last.slice(5).trim();
        if (payload === '[DONE]') {
          body.push('data: [DONE]\n\n');
        } else {
          try {
            const obj = JSON.parse(payload);
            const delta = ((obj.choices || [])[0]?.delta) || {};
            const [content, reasoning] = filter.feed(delta.content || '');
            if (content) body.push('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] }) + '\n\n');
            if (reasoning) body.push('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { reasoning_content: reasoning }, finish_reason: null }] }) + '\n\n');
          } catch { /* ignore trailing partial */ }
        }
      }
      const [tailContent, tailReasoning] = filter.flush();
      if (tailContent) body.push('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: tailContent }, finish_reason: null }] }) + '\n\n');
      if (tailReasoning) body.push('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { reasoning_content: tailReasoning }, finish_reason: null }] }) + '\n\n');
      body.push('data: [DONE]\n\n');
      body.push(null);
    } catch (e) {
      body.destroy(e);
    }
  })();

  return { body, model: model || FREEMODELS_MODEL };
}

// ---------------------------------------------------------------- public API

export async function callAstra({ messages, model, tools, stream }) {
  const m = model || FREEMODELS_MODEL;

  if (tools && Array.isArray(tools) && tools.length) {
    const augmented = injectToolPrompt(messages || [], tools);
    const [content, reasoning] = await chatFreemodels(augmented, m);
    const calls = parseToolCalls(content);
    const completion = calls.length ? toolResponse(m, calls, reasoning) : textResponse(m, content, reasoning);
    if (stream) return { body: completionToSse(completion), model: m };
    return completion;
  }

  if (stream) {
    return streamPassthrough(messages || [], m);
  }

  const [content, reasoning] = await chatFreemodels(messages || [], m);
  return textResponse(m, content, reasoning);
}

export { FREEMODELS_MODEL, FREEMODELS_URL };
