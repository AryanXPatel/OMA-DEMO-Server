const VOICE_ORDER_ALLOWED_SOURCES = ["Phone", "Email", "WhatsApp"];
const CUSTOMER_RANGE = "Customer_Master!A1:N";
const PRODUCT_RANGE = "Product_Master!A1:L";
const ENTITY_INFERENCE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "both",
  "customer",
  "for",
  "from",
  "item",
  "items",
  "make",
  "of",
  "one",
  "order",
  "phone",
  "phones",
  "please",
  "product",
  "quantity",
  "ten",
  "the",
  "this",
  "to",
  "up",
  "with",
]);

const CUSTOMER_INTENT_PATTERNS = [
  /\bcustomer name is\b/i,
  /\bmake an order for\b/i,
  /\bcreate an order for\b/i,
  /\border for\b/i,
  /\bfor\s+[a-z0-9]/i,
];

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NUMBER_WORD_MAP = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
};

function canonicalizeSpeechText(value) {
  let normalized = normalizeText(value);

  normalized = normalized
    .replace(/\bjpl\b/g, "jbl")
    .replace(/\bstrip\b/g, "flip")
    .replace(/\bflips\b/g, "flip")
    .replace(/\bone phone\b/g, "oneplus phone")
    .replace(/\bone plus phone\b/g, "oneplus phone")
    .replace(/\bone\s*\+\s*phone\b/g, "oneplus phone")
    .replace(/\bo one\s*\+\s*phone\b/g, "oneplus phone")
    .replace(/\bone plus\b/g, "oneplus")
    .replace(/\b1 plus\b/g, "oneplus")
    .replace(/\bi one plus\b/g, "oneplus")
    .replace(/\bo one plus\b/g, "oneplus")
    .replace(/\bo one\b/g, "one")
    .replace(/\bi one 12\b/g, "oneplus 12")
    .replace(/\bi one 14\b/g, "oneplus 14")
    .replace(/\bi one 17\b/g, "iphone 17")
    .replace(/\biphone\b/g, "iphone")
    .replace(/\bgalaxy\b/g, "galaxy")
    .replace(/\bwatch\b/g, "watch");

  const convertedTokens = normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => NUMBER_WORD_MAP[token] || token);

  return convertedTokens.join(" ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeNumber(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function levenshteinDistance(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarityScore(left, right) {
  const a = canonicalizeSpeechText(left);
  const b = canonicalizeSpeechText(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 100;
  }

  const distance = levenshteinDistance(a, b);
  const longest = Math.max(a.length, b.length, 1);
  return Math.round((1 - distance / longest) * 100);
}

function tokenize(value) {
  return canonicalizeSpeechText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function pickFirstValue(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function sheetValuesToObjects(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const [headers, ...rows] = values;

  return rows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });
    return record;
  });
}

function stripCodeFences(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function tryParseJsonObject(raw) {
  const cleaned = stripCodeFences(raw);

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function buildServiceError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function fetchSheetObjects(getSheetsContext, range) {
  const { spreadsheetId, sheets } = await getSheetsContext();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return sheetValuesToObjects(response.data.values || []);
}

function buildCustomerCandidate(record, score) {
  return {
    id: pickFirstValue(record, ["Customer CODE"]),
    label: pickFirstValue(record, ["Customer NAME"]),
    score,
    customerCode: pickFirstValue(record, ["Customer CODE"]),
    customerName: pickFirstValue(record, ["Customer NAME"]),
    city: pickFirstValue(record, ["city"]),
    zone: pickFirstValue(record, ["zone"]),
    channel: pickFirstValue(record, ["channel"]),
    industry: pickFirstValue(record, ["industry"]),
    paymentTermsDays: pickFirstValue(record, ["payment_terms_days"]),
    creditLimit: pickFirstValue(record, ["credit_limit"]),
    riskTier: pickFirstValue(record, ["risk_tier"]),
  };
}

function buildProductCandidate(record, score) {
  return {
    id: pickFirstValue(record, ["Product CODE"]),
    label: pickFirstValue(record, ["Product NAME"]),
    score,
    productCode: pickFirstValue(record, ["Product CODE"]),
    productGroup: pickFirstValue(record, ["Product Group Name"]),
    uom: pickFirstValue(record, ["uom"], "Unit"),
    rate: pickFirstValue(record, ["Rate"]),
  };
}

function logCandidatePreview(kind, query, scored, buildCandidate) {
  const preview = scored.slice(0, 3).map(({ record, score }) => ({
    score,
    label: buildCandidate(record, score).label,
    code:
      buildCandidate(record, score).customerCode ||
      buildCandidate(record, score).productCode ||
      buildCandidate(record, score).id,
  }));
  console.log(`[voice-order] ${kind} query="${query}" candidates=`, preview);
}

function getRecordHaystacks(record, kind) {
  if (kind === "customer") {
    const parts = [
      record["Customer NAME"],
      record["Customer CODE"],
      record.city,
      record.zone,
      record.channel,
      record.industry,
    ];

    return [...parts, parts.filter(Boolean).join(" ")];
  }

  const parts = [
    record["Product NAME"],
    record["Product CODE"],
    record["Product Group Name"],
    record.product_group_norm,
    record.brand,
    record.subcategory,
  ];

  return [...parts, parts.filter(Boolean).join(" ")];
}

function buildTranscriptWindows(transcript) {
  const tokens = tokenize(transcript);
  const windows = new Set();

  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= 4; size += 1) {
      const slice = tokens.slice(start, start + size);
      if (slice.length === size) {
        windows.add(slice.join(" "));
      }
    }
  }

  return Array.from(windows);
}

function hasExplicitCustomerIntent(transcript) {
  return CUSTOMER_INTENT_PATTERNS.some((pattern) => pattern.test(transcript));
}

function isMeaningfulEntityWindow(windowText, kind) {
  const tokens = tokenize(windowText);
  if (tokens.length === 0) {
    return false;
  }

  if (kind === "customer" && tokens.some((token) => /\d/.test(token))) {
    return false;
  }

  const meaningfulTokens = tokens.filter(
    (token) =>
      token.length >= 3 &&
      !ENTITY_INFERENCE_STOPWORDS.has(token) &&
      /[a-z]/.test(token)
  );

  return meaningfulTokens.length > 0;
}

function inferEntityQueryFromTranscript(transcript, records, kind) {
  const windows = buildTranscriptWindows(transcript);
  let best = null;

  for (const windowText of windows) {
    if (!isMeaningfulEntityWindow(windowText, kind)) {
      continue;
    }

    const scored = records
      .map((record) => ({
        record,
        score: scoreRecord(windowText, getRecordHaystacks(record, kind)),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (!scored[0]) {
      continue;
    }

    if (!best || scored[0].score > best.score) {
      best = {
        query: windowText,
        score: scored[0].score,
      };
    }
  }

  if (!best || best.score < 60) {
    return "";
  }

  return best.query;
}

function scoreRecord(query, haystacks) {
  const normalizedQuery = canonicalizeSpeechText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const queryTokens = tokenize(normalizedQuery);
  let bestScore = 0;

  for (const rawHaystack of haystacks) {
    const normalizedHaystack = canonicalizeSpeechText(rawHaystack);
    if (!normalizedHaystack) {
      continue;
    }

    if (normalizedHaystack === normalizedQuery) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (normalizedHaystack.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 92);
    }

    if (normalizedHaystack.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 85);
    }

    const fuzzySimilarity = similarityScore(normalizedQuery, normalizedHaystack);
    if (fuzzySimilarity >= 72) {
      bestScore = Math.max(bestScore, 58 + Math.round(fuzzySimilarity * 0.32));
    }

    const haystackTokens = tokenize(normalizedHaystack);
    const queryTextTokens = queryTokens.filter((token) => !/\d/.test(token));
    const queryNumericTokens = queryTokens.filter((token) => /\d/.test(token));

    const matchedTextTokens = queryTextTokens.filter((token) =>
      haystackTokens.some(
        (haystackToken) =>
          haystackToken === token ||
          haystackToken.includes(token) ||
          token.includes(haystackToken)
      )
    ).length;

    const matchedNumericTokens = queryNumericTokens.filter((token) =>
      haystackTokens.includes(token)
    ).length;

    if (matchedTextTokens === queryTextTokens.length && matchedTextTokens > 0) {
      bestScore = Math.max(
        bestScore,
        74 + matchedTextTokens * 6 + matchedNumericTokens * 3
      );
    } else if (matchedTextTokens > 0) {
      const textRatio =
        queryTextTokens.length > 0
          ? matchedTextTokens / queryTextTokens.length
          : 0;
      bestScore = Math.max(
        bestScore,
        Math.round(46 + textRatio * 32 + matchedNumericTokens * 4)
      );
    }
  }

  return bestScore;
}

function buildLlmCatalogContext(transcript, customers, products) {
  const customerCandidates = customers.map((record) => ({
    customerCode: pickFirstValue(record, ["Customer CODE"]),
    customerName: pickFirstValue(record, ["Customer NAME"]),
    city: pickFirstValue(record, ["city"]),
    zone: pickFirstValue(record, ["zone"]),
    channel: pickFirstValue(record, ["channel"]),
  }));

  const productCandidates = products.map((record) => ({
    productCode: pickFirstValue(record, ["Product CODE"]),
    productName: pickFirstValue(record, ["Product NAME"]),
    productGroup: pickFirstValue(record, ["Product Group Name"]),
    brand: pickFirstValue(record, ["brand"]),
    subcategory: pickFirstValue(record, ["subcategory"]),
    uom: pickFirstValue(record, ["uom"], "Unit"),
  }));

  return {
    customerCandidates,
    productCandidates,
  };
}

function resolveCustomer(customers, query) {
  const normalizedQuery = canonicalizeSpeechText(query);
  if (!normalizedQuery) {
    return { status: "rejected", reason: "Customer query missing" };
  }

  const scored = customers
    .map((record) => ({
      record,
      score: scoreRecord(normalizedQuery, [
        record["Customer NAME"],
        record["Customer CODE"],
        record.city,
        record.zone,
      ]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  logCandidatePreview("customer", query, scored, buildCustomerCandidate);

  if (scored.length === 0) {
    return { status: "rejected", reason: `No customer match for "${query}"` };
  }

  const [first, second] = scored;
  if (first && first.score >= 68 && (!second || first.score - second.score >= 7)) {
    return {
      status: "matched",
      value: {
        customerCode: pickFirstValue(first.record, ["Customer CODE"]),
        customerName: pickFirstValue(first.record, ["Customer NAME"]),
        city: pickFirstValue(first.record, ["city"]),
        zone: pickFirstValue(first.record, ["zone"]),
        channel: pickFirstValue(first.record, ["channel"]),
        industry: pickFirstValue(first.record, ["industry"]),
        paymentTermsDays: pickFirstValue(first.record, ["payment_terms_days"]),
        creditLimit: pickFirstValue(first.record, ["credit_limit"]),
        riskTier: pickFirstValue(first.record, ["risk_tier"]),
      },
    };
  }

  if (
    !first ||
    (second &&
      (first.score < 100 || first.score - second.score < 8 || second.score >= 92))
  ) {
    return {
      status: "needs_disambiguation",
      disambiguation: {
        kind: "customer",
        query,
        candidates: scored.slice(0, 3).map(({ record, score }) =>
          buildCustomerCandidate(record, score)
        ),
      },
    };
  }

  return {
    status: "matched",
    value: {
      customerCode: pickFirstValue(first.record, ["Customer CODE"]),
      customerName: pickFirstValue(first.record, ["Customer NAME"]),
      city: pickFirstValue(first.record, ["city"]),
      zone: pickFirstValue(first.record, ["zone"]),
      channel: pickFirstValue(first.record, ["channel"]),
      industry: pickFirstValue(first.record, ["industry"]),
      paymentTermsDays: pickFirstValue(first.record, ["payment_terms_days"]),
      creditLimit: pickFirstValue(first.record, ["credit_limit"]),
      riskTier: pickFirstValue(first.record, ["risk_tier"]),
    },
  };
}

function resolveProduct(products, query) {
  const normalizedQuery = canonicalizeSpeechText(query);
  if (!normalizedQuery) {
    return { status: "rejected", reason: "Product query missing" };
  }

  const scored = products
    .map((record) => ({
      record,
      score: scoreRecord(normalizedQuery, [
        record["Product NAME"],
        record["Product CODE"],
        record["Product Group Name"],
        record.product_group_norm,
        record.brand,
        record.subcategory,
      ]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  logCandidatePreview("product", query, scored, buildProductCandidate);

  if (scored.length === 0) {
    return { status: "rejected", reason: `No product match for "${query}"` };
  }

  const [first, second] = scored;
  if (first && first.score >= 68 && (!second || first.score - second.score >= 10)) {
    return {
      status: "matched",
      value: {
        productCode: pickFirstValue(first.record, ["Product CODE"]),
        productName: pickFirstValue(first.record, ["Product NAME"]),
        productGroup: pickFirstValue(first.record, ["Product Group Name"]),
        unit: pickFirstValue(first.record, ["uom"], "Unit"),
        rate: pickFirstValue(first.record, ["Rate"]),
      },
    };
  }

  if (
    !first ||
    (second &&
      (first.score < 100 || first.score - second.score < 8 || second.score >= 92))
  ) {
    return {
      status: "needs_disambiguation",
      disambiguation: {
        kind: "product",
        query,
        candidates: scored.slice(0, 3).map(({ record, score }) =>
          buildProductCandidate(record, score)
        ),
      },
    };
  }

  return {
    status: "matched",
    value: {
      productCode: pickFirstValue(first.record, ["Product CODE"]),
      productName: pickFirstValue(first.record, ["Product NAME"]),
      productGroup: pickFirstValue(first.record, ["Product Group Name"]),
      unit: pickFirstValue(first.record, ["uom"], "Unit"),
      rate: pickFirstValue(first.record, ["Rate"]),
    },
  };
}

function normalizeDraft(bodyDraft) {
  const draft = bodyDraft && typeof bodyDraft === "object" ? bodyDraft : {};
  const products = Array.isArray(draft.products) ? draft.products : [];

  return {
    customerName: String(draft.customerName || "").trim(),
    customerCode: String(draft.customerCode || "").trim(),
    orderComments: String(draft.orderComments || "").trim(),
    orderSource: String(draft.orderSource || "Phone").trim() || "Phone",
    orderDateIso: String(draft.orderDateIso || "").trim(),
    draftRevision: Number.isFinite(Number(draft.draftRevision))
      ? Number(draft.draftRevision)
      : null,
    lastTouchedProductCode: String(draft.lastTouchedProductCode || "").trim(),
    products: products.map((product, index) => ({
      lineId: String(product?.lineId || "").trim() || `line-${index}`,
      lineIndex: index,
      productCode: String(product?.productCode || "").trim(),
      productName: String(product?.productName || "").trim(),
      quantity: safeNumber(product?.quantity),
      unit: String(product?.unit || "").trim(),
    })),
  };
}

async function transcribeAudio({
  audioBase64,
  audioUrl,
  mimeType,
  transcriptOverride,
}) {
  if (typeof transcriptOverride === "string" && transcriptOverride.trim()) {
    const transcript = transcriptOverride.trim();
    console.log("[voice-order] transcript override:", transcript);
    return transcript;
  }

  const apiKey = readEnv("DEEPGRAM_API_KEY");
  if (!apiKey) {
    throw buildServiceError("Missing DEEPGRAM_API_KEY", 500);
  }

  const endpoint =
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&dictation=true";

  let response;

  if (typeof audioUrl === "string" && audioUrl.trim()) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl.trim() }),
    });
  } else if (typeof audioBase64 === "string" && audioBase64.trim()) {
    const audioBuffer = Buffer.from(audioBase64.trim(), "base64");
    if (audioBuffer.byteLength > 8 * 1024 * 1024) {
      throw buildBadRequest("Audio payload is too large");
    }
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": mimeType?.trim() || "audio/webm",
      },
      body: audioBuffer,
    });
  } else {
    throw buildBadRequest(
      "Provide transcriptOverride, audioUrl, or audioBase64 for voice-order draft requests"
    );
  }

  if (!response.ok) {
    throw buildServiceError(
      `Deepgram transcription failed (${response.status})`,
      502
    );
  }

  const payload = await response.json();
  const transcript =
    payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";

  if (!transcript) {
    throw buildServiceError("Deepgram returned an empty transcript", 422);
  }

  console.log("[voice-order] deepgram transcript:", transcript);

  return transcript;
}

function buildVoiceOrderPrompt({ transcript, draft, llmContext }) {
  const today = new Date().toISOString();

  return [
    "You extract structured order-draft mutations from a single user utterance.",
    "Return JSON only. No markdown. No prose outside JSON.",
    "Users often speak rough colloquial references instead of exact live catalog names.",
    "Examples: iphone 14, samsung edge, reliance, raj traders, urgent morning delivery.",
    "Return the rough customer/product phrase you heard even when it is approximate.",
    "Indian business names and spoken model names may be partially wrong because of speech recognition.",
    "Preserve the most likely spoken phrase instead of dropping the customer or product.",
    "Example: 'amazon india enterprises' should become a rough customer query, not an empty field.",
    "Example: 'oneplus phones' should become a rough product query for the OnePlus phone family.",
    "Example: 'iphone seventeen' should become a rough product query, not an exact catalog rewrite.",
    "If the transcript is only about notes or delivery comments, do not invent a customer operation.",
    "Use the live catalog context below to choose rough customer and product queries from real data.",
    "The live customer and product lists below are authoritative. Prefer choosing from them over inventing new names.",
    "When one list entry is clearly the intended match, return that exact customerName/productName and customerCode/productCode from the live lists.",
    "If the current draft already has a customer and the transcript sounds like a follow-up add command, keep that customer unless the user clearly names a different one.",
    "Do not collapse different spoken products into the same product query. Keep separate add_line operations distinct.",
    "Allowed operation types:",
    '["set_customer","add_line","increase_qty","decrease_qty","set_qty","remove_line","replace_line","append_note","overwrite_note","set_order_source","set_order_date_time","clear_note","clear_draft","unknown"]',
    "Rules:",
    "- Prefer append_note by default when the user says add or also mention note text.",
    "- Use overwrite_note only when the user explicitly says replace note or overwrite note.",
    "- If the user says 'this customer', that means keep the current draft customer and do not invent a new one.",
    "- For pronouns like 'it' or '2 more', use target_reference='last_line'.",
    "- Use set_order_source only for Phone, Email, or WhatsApp.",
    "- Keep quantities numeric.",
    "- If the user asks for unsupported behavior, emit type='unknown' with reason.",
    `Current date/time: ${today}`,
    `Current draft snapshot: ${JSON.stringify(draft)}`,
    `Live customer candidates from current data: ${JSON.stringify(
      llmContext.customerCandidates
    )}`,
    `Live product candidates from current data: ${JSON.stringify(
      llmContext.productCandidates
    )}`,
    `User transcript: ${JSON.stringify(transcript)}`,
    'Return this shape: {"intent":"update_order","summary":"...","operations":[...]}',
  ].join("\n");
}

async function parseTranscriptWithLlm({ transcript, draft, customers, products }) {
  const baseUrl = readEnv("VOICE_ORDER_LLM_BASE_URL").replace(/\/+$/, "");
  const apiKey = readEnv("CODEX_LB_API_KEY");
  const model = readEnv("VOICE_ORDER_LLM_MODEL") || "deepseek-chat";

  if (!baseUrl) {
    throw buildServiceError("Missing VOICE_ORDER_LLM_BASE_URL", 500);
  }

  if (!apiKey) {
    throw buildServiceError("Missing CODEX_LB_API_KEY", 500);
  }

  const llmContext = buildLlmCatalogContext(transcript, customers, products);
  console.log("[voice-order] llm context counts:", {
    customers: llmContext.customerCandidates.length,
    products: llmContext.productCandidates.length,
  });

  // VOICE_ORDER_LLM_BASE_URL should include /v1 (e.g. https://api.deepseek.com/v1)
  const chatBaseUrl = baseUrl;

  const response = await fetch(`${chatBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a strict order-draft parser. Return valid JSON only.",
        },
        {
          role: "user",
          content: buildVoiceOrderPrompt({ transcript, draft, llmContext }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw buildServiceError(`Voice-order LLM request failed (${response.status})`, 502);
  }

  const payload = await response.json();
  const content =
    payload?.choices?.[0]?.message?.content ||
    payload?.choices?.[0]?.delta?.content ||
    "";

  const parsed = tryParseJsonObject(content);
  if (!parsed || !Array.isArray(parsed.operations)) {
    throw buildServiceError("LLM returned invalid voice-order JSON", 422);
  }

  return {
    model,
    normalizedCommand: {
      intent: parsed.intent || "update_order",
      summary: parsed.summary || "",
      operations: parsed.operations,
    },
  };
}

function enrichOperationsFromTranscript({
  transcript,
  normalizedCommand,
  draft,
  customers,
  products,
}) {
  const explicitCustomerIntent = hasExplicitCustomerIntent(transcript);
  const operations = Array.isArray(normalizedCommand.operations)
    ? normalizedCommand.operations.map((operation) => ({ ...operation }))
    : [];

  let hasCustomerOperation = false;
  const hasOrderingIntent = operations.some((operation) =>
    ["add_line", "increase_qty", "decrease_qty", "set_qty", "replace_line"].includes(
      String(operation?.type || "").trim()
    )
  );

  for (const operation of operations) {
    if (
      operation.type === "set_customer" &&
      draft.customerName &&
      !explicitCustomerIntent
    ) {
      operation.keep_current_customer = true;
      delete operation.customer_query;
      delete operation.customerName;
      delete operation.customer_name;
      hasCustomerOperation = true;
      continue;
    }

    if (
      operation.type === "set_customer" &&
      /(?:^|\b)(this customer|current customer)(?:\b|$)/i.test(transcript)
    ) {
      operation.keep_current_customer = true;
      delete operation.customer_query;
      delete operation.customerName;
      delete operation.customer_name;
      hasCustomerOperation = true;
      continue;
    }

    if (operation.type === "set_customer") {
      hasCustomerOperation = true;
      if (!readCustomerQuery(operation)) {
        const inferredCustomerQuery = inferEntityQueryFromTranscript(
          transcript,
          customers,
          "customer"
        );
        if (inferredCustomerQuery) {
          operation.customer_query = inferredCustomerQuery;
        }
      }
    }

    if (operation.type === "add_line" && !readProductQuery(operation)) {
      const inferredProductQuery = inferEntityQueryFromTranscript(
        transcript,
        products,
        "product"
      );
      if (inferredProductQuery) {
        operation.product_query = inferredProductQuery;
      }
    }
  }

  if (!hasCustomerOperation) {
    if (draft.customerName && hasOrderingIntent && !explicitCustomerIntent) {
      operations.unshift({
        type: "set_customer",
        keep_current_customer: true,
      });
      console.log(
        "[voice-order] kept current customer for follow-up ordering command"
      );
      console.log("[voice-order] normalized operations:", operations);
      return {
        ...normalizedCommand,
        operations,
      };
    }

    if (!hasOrderingIntent) {
      console.log(
        "[voice-order] skipped customer inference because transcript only changed notes or metadata"
      );
      console.log("[voice-order] normalized operations:", operations);
      return {
        ...normalizedCommand,
        operations,
      };
    }

    if (
      draft.customerName &&
      /(?:^|\b)(this customer|current customer)(?:\b|$)/i.test(transcript)
    ) {
      operations.unshift({
        type: "set_customer",
        keep_current_customer: true,
      });
    } else {
      const inferredCustomerQuery = inferEntityQueryFromTranscript(
        transcript,
        customers,
        "customer"
      );
      if (inferredCustomerQuery) {
        operations.unshift({
          type: "set_customer",
          customer_query: inferredCustomerQuery,
        });
      }
    }
  }

  console.log("[voice-order] normalized operations:", operations);

  return {
    ...normalizedCommand,
    operations,
  };
}

function resolveDraftLine(draft, operation) {
  const requestedLineId = String(operation.lineId || operation.line_id || "").trim();
  const requestedCode = normalizeText(
    operation.product_code || operation.productCode || ""
  );
  const requestedQuery = normalizeText(readTargetProductQuery(operation));

  if (requestedLineId) {
    const exactByLineId = draft.products.find(
      (product) => product.lineId === requestedLineId
    );
    if (exactByLineId) {
      return { status: "matched", value: exactByLineId };
    }
  }

  if (requestedCode) {
    const exactByCode = draft.products.find(
      (product) => normalizeText(product.productCode) === requestedCode
    );
    if (exactByCode) {
      return { status: "matched", value: exactByCode };
    }
  }

  if (requestedQuery) {
    const matches = draft.products.filter((product) =>
      [product.productName, product.productCode]
        .map(normalizeText)
        .some((value) => value && value.includes(requestedQuery))
    );

    if (matches.length === 1) {
      return { status: "matched", value: matches[0] };
    }

    if (matches.length > 1) {
      return {
        status: "needs_disambiguation",
        disambiguation: {
          kind: "draft_line",
          query: readTargetProductQuery(operation),
          candidates: matches.slice(0, 3).map((product) => ({
            id: product.lineId || product.productCode || `${product.lineIndex}`,
            label: product.productName,
            lineId: product.lineId,
            lineIndex: product.lineIndex,
          })),
        },
      };
    }
  }

  if (operation.target_reference === "last_line") {
    const explicitLast = draft.products.find(
      (product) => product.productCode === draft.lastTouchedProductCode
    );

    if (explicitLast) {
      return { status: "matched", value: explicitLast };
    }

    const fallbackLast = draft.products[draft.products.length - 1];
    if (fallbackLast) {
      return { status: "matched", value: fallbackLast };
    }
  }

  if (draft.products.length === 1) {
    return { status: "matched", value: draft.products[0] };
  }

  return {
    status: "rejected",
    reason: "Could not determine which draft line to change",
  };
}

function normalizeSource(value) {
  const normalized = normalizeText(value);
  const directMatch = VOICE_ORDER_ALLOWED_SOURCES.find(
    (source) => normalizeText(source) === normalized
  );

  if (directMatch) {
    return directMatch;
  }

  if (normalized === "whatsapp order" || normalized === "whatsapp message") {
    return "WhatsApp";
  }

  if (normalized === "phone order" || normalized === "call") {
    return "Phone";
  }

  return "";
}

function readOperationQuantity(operation) {
  return safeNumber(
    operation.quantity ??
      operation.qty ??
      operation.count ??
      operation.delta ??
      operation.value ??
      operation.replacement_quantity
  );
}

function readOperationText(operation) {
  return String(
    operation.noteText ??
    operation.note_text ??
      operation.note ??
      operation.text ??
      operation.value ??
      ""
  ).trim();
}

function readCustomerQuery(operation) {
  return String(
    operation.customerQuery ??
    operation.customer_query ??
    operation.customerName ??
    operation.customer_name ??
      ""
  ).trim();
}

function readProductQuery(operation) {
  return String(
    operation.productQuery ??
    operation.product_query ??
    operation.productName ??
    operation.product_name ??
      ""
  ).trim();
}

function readTargetProductQuery(operation) {
  return String(
    operation.targetProductQuery ??
    operation.target_product_query ??
      operation.product_query ??
      operation.productQuery ??
      operation.productName ??
      operation.product_name ??
      ""
  ).trim();
}

function readReplacementProductQuery(operation) {
  return String(
    operation.replacementProductQuery ??
    operation.replacement_product_query ??
      operation.replacement_product_name ??
      operation.replacementProductName ??
      ""
  ).trim();
}

function buildMutationResult(base) {
  return {
    status: "applied",
    transcript: base.transcript,
    model: base.model,
    normalizedCommand: base.normalizedCommand,
    mutations: base.mutations,
    confirmationMessage: base.confirmationMessage,
    warnings: base.warnings || [],
  };
}

function applyStrictPlanning({
  transcript,
  draft,
  normalizedCommand,
  customers,
  products,
  model,
}) {
  const operations = Array.isArray(normalizedCommand.operations)
    ? normalizedCommand.operations
    : [];
  const mutations = [];
  const warnings = [];
  const hasProductIntent = operations.some((operation) =>
    ["add_line", "increase_qty", "decrease_qty", "set_qty", "replace_line"].includes(
      String(operation?.type || "").trim()
    )
  );

  for (const rawOperation of operations) {
    const operation =
      rawOperation && typeof rawOperation === "object" ? rawOperation : {};
    const type = String(operation.type || "").trim();

    if (!type || type === "unknown") {
      warnings.push(operation.reason || "Skipped unsupported voice operation");
      continue;
    }

    if (type === "set_customer") {
      if (operation.keep_current_customer && draft.customerName) {
        continue;
      }

      const match = resolveCustomer(
        customers,
        readCustomerQuery(operation)
      );

      if (match.status !== "matched") {
        if (
          draft.customerName &&
          hasProductIntent &&
          !operation.keep_current_customer
        ) {
          warnings.push(
            `Skipped unresolved customer fragment "${readCustomerQuery(operation)}" and kept current customer`
          );
          continue;
        }

        return {
          status: match.status,
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          ...(match.disambiguation ? { disambiguation: match.disambiguation } : {}),
          ...(match.reason ? { error: match.reason } : {}),
        };
      }

      mutations.push({
        type,
        customerCode: match.value.customerCode,
        customerName: match.value.customerName,
        city: match.value.city,
        zone: match.value.zone,
        channel: match.value.channel,
        industry: match.value.industry,
        paymentTermsDays: match.value.paymentTermsDays,
        creditLimit: match.value.creditLimit,
        riskTier: match.value.riskTier,
      });
      continue;
    }

    if (type === "add_line") {
      const productMatch = resolveProduct(
        products,
        readProductQuery(operation)
      );

      if (productMatch.status !== "matched") {
        return {
          status: productMatch.status,
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          ...(productMatch.disambiguation
            ? { disambiguation: productMatch.disambiguation }
            : {}),
          ...(productMatch.reason ? { error: productMatch.reason } : {}),
        };
      }

      const quantity = safeNumber(operation.quantity);
      const resolvedQuantity = readOperationQuantity(operation);
      if (!resolvedQuantity || resolvedQuantity <= 0) {
        return {
          status: "rejected",
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          error: "Add-line operations require a positive quantity",
        };
      }

      mutations.push({
        type,
        quantity: resolvedQuantity,
        ...productMatch.value,
      });
      continue;
    }

    if (
      type === "increase_qty" ||
      type === "decrease_qty" ||
      type === "set_qty" ||
      type === "remove_line"
    ) {
      const line = resolveDraftLine(draft, operation);
      if (line.status !== "matched") {
        return {
          status: line.status,
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          ...(line.disambiguation ? { disambiguation: line.disambiguation } : {}),
          ...(line.reason ? { error: line.reason } : {}),
        };
      }

      const payload = {
        type,
        lineId: line.value.lineId,
        lineIndex: line.value.lineIndex,
        productCode: line.value.productCode,
        productName: line.value.productName,
        requiresConfirmation:
          type === "decrease_qty" || type === "remove_line",
      };

      if (type !== "remove_line") {
        const quantity = readOperationQuantity(operation);
        if (!quantity || quantity <= 0) {
          return {
            status: "rejected",
            transcript,
            model,
            normalizedCommand,
            mutations: [],
            confirmationMessage: "",
            warnings,
            error: `${type} requires a positive quantity`,
          };
        }
        payload.quantity = quantity;
      }

      mutations.push(payload);
      continue;
    }

    if (type === "replace_line") {
      const currentLine = resolveDraftLine(draft, operation);
      if (currentLine.status !== "matched") {
        return {
          status: currentLine.status,
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          ...(currentLine.disambiguation
            ? { disambiguation: currentLine.disambiguation }
            : {}),
          ...(currentLine.reason ? { error: currentLine.reason } : {}),
        };
      }

      const replacement = resolveProduct(
        products,
        readReplacementProductQuery(operation) || readProductQuery(operation)
      );

      if (replacement.status !== "matched") {
        return {
          status: replacement.status,
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          ...(replacement.disambiguation
            ? { disambiguation: replacement.disambiguation }
            : {}),
          ...(replacement.reason ? { error: replacement.reason } : {}),
        };
      }

      const quantity =
        readOperationQuantity(operation) ||
        currentLine.value.quantity ||
        safeNumber(operation.replacement_quantity);

      mutations.push({
        type,
        lineId: currentLine.value.lineId,
        lineIndex: currentLine.value.lineIndex,
        previousProductCode: currentLine.value.productCode,
        previousProductName: currentLine.value.productName,
        quantity: quantity || 1,
        replacement: replacement.value,
        requiresConfirmation: true,
      });
      continue;
    }

    if (type === "append_note" || type === "overwrite_note") {
      const noteText = readOperationText(operation);

      if (!noteText) {
        return {
          status: "rejected",
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          error: `${type} requires note text`,
        };
      }

      mutations.push({
        type,
        noteText,
        requiresConfirmation: type === "overwrite_note",
      });
      continue;
    }

    if (type === "set_order_source") {
      const source = normalizeSource(
        operation.order_source || operation.orderSource || operation.source || ""
      );

      if (!source) {
        return {
          status: "rejected",
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          error: "Unsupported order source",
        };
      }

      mutations.push({
        type,
        source,
      });
      continue;
    }

    if (type === "set_order_date_time") {
      const datetimeText = String(
        operation.datetimeText ??
          operation.isoDateTime ??
          operation.orderDateIso ??
          operation.datetime_text ??
          operation.value ??
          ""
      ).trim();

      if (!datetimeText) {
        return {
          status: "rejected",
          transcript,
          model,
          normalizedCommand,
          mutations: [],
          confirmationMessage: "",
          warnings,
          error: "set_order_date_time requires datetime text",
        };
      }

      mutations.push({
        type,
        datetimeText,
      });
      continue;
    }

    if (type === "clear_note" || type === "clear_draft") {
      mutations.push({
        type,
        requiresConfirmation: true,
      });
      continue;
    }

    warnings.push(`Skipped unsupported operation type: ${type}`);
  }

  if (mutations.length === 0) {
    return {
      status: "rejected",
      transcript,
      model,
      normalizedCommand,
      mutations: [],
      confirmationMessage: "",
      warnings,
      error: "No supported voice-order mutations were produced",
    };
  }

  return buildMutationResult({
    transcript,
    model,
    normalizedCommand,
    mutations,
    confirmationMessage:
      normalizedCommand.summary || "Updated the order draft from voice input.",
    warnings,
  });
}

async function buildVoiceOrderDraftResponse({ body, getSheetsContext }) {
  const draft = normalizeDraft(body?.draft);
  const transcript = await transcribeAudio({
    audioBase64: body?.audioBase64,
    audioUrl: body?.audioUrl,
    mimeType: body?.mimeType,
    transcriptOverride: body?.transcriptOverride,
  });

  const [customers, products] = await Promise.all([
    fetchSheetObjects(getSheetsContext, CUSTOMER_RANGE),
    fetchSheetObjects(getSheetsContext, PRODUCT_RANGE),
  ]);

  const { model, normalizedCommand } = await parseTranscriptWithLlm({
    transcript,
    draft,
    customers,
    products,
  });

  const enrichedCommand = enrichOperationsFromTranscript({
    transcript,
    normalizedCommand,
    draft,
    customers,
    products,
  });

  return applyStrictPlanning({
    transcript,
    draft,
    normalizedCommand: enrichedCommand,
    customers,
    products,
    model,
  });
}

module.exports = {
  buildVoiceOrderDraftResponse,
  VOICE_ORDER_ALLOWED_SOURCES,
};
