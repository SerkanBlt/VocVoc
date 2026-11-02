/* The AI service of VocVoc: one endpoint, POST /api/ai, written as a Cloudflare Pages Function (the page and the endpoint share an origin, so the page's
   Content-Security-Policy stays connect-src 'self'). The API key is the secret ANTHROPIC_API_KEY of this project and never reaches the browser.
   The page sends {task, payload}; the prompts live here, so the endpoint cannot be used as a general chat proxy. Every field is clipped and checked.
   Set AI_MOCK=1 to answer with fixed examples (local development, tests: no key, no cost). */
const MODEL_FAST = 'claude-haiku-5-5';
const MODEL_SMART = 'claude-sonnet-5-5';
const LANGUAGES = { fr: 'French', en: 'English', de: 'German', es: 'Spanish', it: 'Italian', tr: 'Turkish' };
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MAX_BODY = 24000;

const clip = (value, max) => String(value ?? '').slice(0, max);
const lang = code => LANGUAGES[code] || 'French';
const words = list => (Array.isArray(list) ? list : []).slice(0, 30).map(w => clip(w, 60)).filter(Boolean);

function common(p) {
  const level = LEVELS.includes(p.level) ? p.level : 'A1';
  return { level, target: lang(p.target), native: lang(p.native || 'tr') };
}

// Each task: model, token limit, the system prompt and the user message, built from the clipped payload. All answer with one JSON object.
const TASKS = {
  chat(p) {
    const { level, target, native } = common(p);
    const list = words(p.words);
    const turns = (Array.isArray(p.history) ? p.history : []).slice(-24).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clip(m.text, 600) }));
    if (p.mode === 'end') {
      return {
        model: MODEL_SMART, max: 1400,
        system: `You are a ${target} tutor evaluating a spoken practice conversation with a ${level} learner whose first language is ${native}. Target words: ${list.join(', ')}.
Reply with ONE JSON object only: {"summary": string (2-3 sentences in ${native}), "score": integer 0-100, "strengths": [string in ${native}], "mistakes": [{"said": string, "better": string, "note": string in ${native}, "word": string or ""}], "wordsUsed": [string], "wordsMissed": [string], "advice": string in ${native}}. List at most 8 real mistakes taken from the learner's lines. "said" is copied from the learner. Do not invent mistakes.`,
        messages: [{ role: 'user', content: 'Conversation:\n' + turns.map(m => (m.role === 'user' ? 'Learner: ' : 'Tutor: ') + m.content).join('\n') }],
      };
    }
    return {
      model: MODEL_FAST, max: 400,
      system: `You are a friendly ${target} conversation partner for a ${level} learner whose first language is ${native}. Keep to ${level} vocabulary and grammar. Your reply is read aloud: 1-3 short sentences in ${target}, no markdown, no emojis. Steer the talk so the learner needs these words: ${list.join(', ')}. Ask one question at the end. Do not correct the learner during the talk.
Reply with ONE JSON object only: {"reply": string}.`,
      messages: turns.length ? turns : [{ role: 'user', content: '(The learner has joined. Start the conversation.)' }],
    };
  },
  spell(p) {
    const { level, target } = common(p);
    return {
      model: MODEL_FAST, max: 150,
      system: `You check the spelling of ONE ${target} word written by a ${level} learner inside a sentence. Reply with ONE JSON object only: {"ok": boolean, "correct": string}. "correct" is the right spelling of that word (with accents) as it should stand in the sentence; when the word is already right, ok is true and correct equals the word.`,
      messages: [{ role: 'user', content: JSON.stringify({ sentence: clip(p.sentence, 300), word: clip(p.word, 60) }) }],
    };
  },
  improve(p) {
    const { level, target, native } = common(p);
    return {
      model: MODEL_SMART, max: 600,
      system: `You correct a sentence written in ${target} by a ${level} learner whose first language is ${native}. Reply with ONE JSON object only: {"ok": boolean, "better": string, "mistakes": [{"said": string, "better": string, "note": string in ${native}}]}. "better" is the sentence with spelling, grammar and word order fixed, as close to the learner's own words as possible and at ${level} level. If the sentence is already right, ok is true and better equals it. At most 4 mistakes, each a short piece copied from the learner's sentence.`,
      messages: [{ role: 'user', content: JSON.stringify({ sentence: clip(p.sentence, 300), word: clip(p.word, 60) }) }],
    };
  },
  story(p) {
    const { level, target, native } = common(p);
    const list = words(p.words);
    return {
      model: MODEL_SMART, max: 2200,
      system: `You write short stories for language learners. Write a story of about 120-180 words in ${target} at CEFR level ${level} that uses as many of these words as is natural: ${list.join(', ')}. Then write 4 multiple-choice comprehension questions about it, in ${target}, with 3 options each.
Reply with ONE JSON object only: {"title": string, "text": string (paragraphs separated by \\n\\n), "translation": string (the story in ${native}), "used": [string] (target words that appear, as given above), "quiz": [{"q": string, "options": [string, string, string], "answer": integer index of the right option}]}.`,
      messages: [{ role: 'user', content: 'Write the story.' }],
    };
  },
  analyze(p) {
    const { level, target, native } = common(p);
    const list = (Array.isArray(p.mistakes) ? p.mistakes : []).slice(0, 60).map(m => ({ area: clip(m.area, 12), said: clip(m.said, 200), better: clip(m.better, 200), note: clip(m.note, 200), word: clip(m.word, 60) }));
    return {
      model: MODEL_SMART, max: 1500,
      system: `You analyse the mistakes a ${level} learner of ${target} (first language ${native}) made in conversation, sentence writing and story quizzes. Find the patterns, not single slips. Reply with ONE JSON object only: {"summary": string (2-3 sentences in ${native}), "patterns": [{"title": string in ${native}, "explanation": string in ${native}, "examples": [{"said": string, "better": string}]}], "tips": [string in ${native}], "focusWords": [string in ${target}]}. At most 4 patterns, 5 tips, 8 focus words.`,
      messages: [{ role: 'user', content: JSON.stringify(list) }],
    };
  },
};

const MOCK = {
  chat: p => (p.mode === 'end'
    ? { summary: 'İyi bir konuşmaydı. Birkaç küçük hata var.', score: 72, strengths: ['Cümleleri tamamladın.'], mistakes: [{ said: 'Je suis allé à le marché', better: 'Je suis allé au marché', note: '"à le" birleşir: "au".', word: 'marché' }], wordsUsed: words(p.words).slice(0, 2), wordsMissed: words(p.words).slice(2, 4), advice: 'Edatları kelimelerle birleştirmeye dikkat et.' }
    : { reply: 'Bonjour ! Comment vas-tu aujourd’hui ?' }),
  spell: p => ({ ok: false, correct: clip(p.word, 60).replace(/e$/, 'é') }),
  improve: p => ({ ok: false, better: clip(p.sentence, 300).replace(/\s+/g, ' ').trim() + ' (mock)', mistakes: [{ said: clip(p.sentence, 40), better: 'mock', note: 'Örnek düzeltme.' }] }),
  story: p => ({ title: 'Une petite histoire', text: 'Marie va au marché. Elle achète du pain.\n\nPuis elle rentre à la maison.', translation: 'Marie pazara gider. Ekmek alır.\n\nSonra eve döner.', used: words(p.words).slice(0, 2), quiz: [{ q: 'Où va Marie ?', options: ['Au marché', 'À l’école', 'Au cinéma'], answer: 0 }, { q: 'Que fait-elle à la fin ?', options: ['Elle dort', 'Elle rentre', 'Elle chante'], answer: 1 }] }),
  analyze: () => ({ summary: 'Edat birleşmelerinde tekrar eden hatalar var.', patterns: [{ title: 'à + le = au', explanation: 'Eril isimlerin önünde "à le" yazılmaz.', examples: [{ said: 'à le marché', better: 'au marché' }] }], tips: ['Her gün 5 cümle yaz.'], focusWords: ['marché'] }),
};

function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON');
  return JSON.parse(text.slice(start, end + 1));
}

export async function handle(body, env, fetchImpl = fetch) {
  const make = TASKS[body && body.task];
  if (!make || typeof body.payload !== 'object' || body.payload === null) return [400, { error: 'bad task' }];
  if (env.AI_MOCK === '1') return [200, MOCK[body.task](body.payload)];
  if (!env.ANTHROPIC_API_KEY) return [503, { error: 'not configured' }];
  const job = make(body.payload);
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: job.model, max_tokens: job.max, system: job.system, messages: job.messages }),
  });
  if (response.status === 429) return [429, { error: 'busy' }];
  if (!response.ok) {
    let detail = '';
    try { const e = (await response.json()).error || {}; detail = ': ' + clip((e.type || '') + ' ' + (e.message || ''), 140).trim(); } catch (_) {}
    return [502, { error: 'upstream ' + response.status + detail }];
  }
  try {
    const data = await response.json();
    return [200, parseJson((data.content || []).map(part => part.text || '').join(''))];
  } catch (_) {
    return [502, { error: 'unusable answer (the model reply was not JSON or was cut off)' }];
  }
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('{"error":"origin"}', { status: 403 });   // only this site's pages
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response('{"error":"too large"}', { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch (_) { return new Response('{"error":"bad json"}', { status: 400 }); }
  const [status, data] = await handle(body, env);
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
