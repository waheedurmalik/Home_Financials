const functions = require("@google-cloud/functions-framework");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");
const pdfParse = require("pdf-parse");

admin.initializeApp();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// ── PII scrubbing ──────────────────────────────────────────────────────────────
function scrubPII(text) {
  const samples = [];
  function redact(t, pattern, tag) {
    return t.replace(pattern, function(match) {
      const last4 = match.replace(/[\s\-]/g, "").slice(-4);
      if (!samples.find(s => s.type === tag && s.last4 === last4)) {
        samples.push({ type: tag, last4 });
      }
      return "[" + tag + "]";
    });
  }

  let t = text;
  t = redact(t, /\b[A-Z]{2}\d{2}[\s\-]?(?:[A-Z0-9]{1,4}[\s\-]?){4,7}/g,           "IBAN");
  t = redact(t, /\b(?:\d{4}[\s\-]){3}\d{4}\b/g,                                     "CARD");
  t = redact(t, /\b\d{13}\b/g,                                                        "UAEACCT");
  t = redact(t, /\b\d{8,12}\b/g,                                                      "ACCT");
  t = redact(t, /\b\d{2}[\-]\d{2}[\-]\d{2}\b/g,                                      "SORT");
  t = redact(t, /(?:\+?\d[\s\-]?){10,15}/g,                                           "PHONE");
  t = redact(t, /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,               "EMAIL");
  t = redact(t, /P\.?O\.?\s*Box\s*\d+/gi,                                             "POBOX");
  t = redact(t, /784[\-]\d{4}[\-]\d{7}[\-]\d/g,                                      "EMIRATESID");

  const types = {};
  samples.forEach(function(s) { types[s.type] = (types[s.type] || 0) + 1; });
  return { text: t, piiReport: { count: samples.length, types, samples } };
}

const CHUNK_SIZE    = 5000;
const CHUNK_OVERLAP = 200;

function splitIntoChunks(text, chunkSize) {
  chunkSize = chunkSize || CHUNK_SIZE;
  const chunks = [];
  let pos = 0;
  while (pos < text.length) {
    let end = pos + chunkSize;
    if (end >= text.length) { chunks.push(text.slice(pos)); break; }
    let breakAt = text.lastIndexOf("\n", end);
    if (breakAt <= pos) { breakAt = end; }
    chunks.push(text.slice(pos, breakAt));
    pos = Math.max(pos + 1, breakAt - CHUNK_OVERLAP);
  }
  return chunks.length ? chunks : [text];
}

function buildPrompt(chunkText, chunkIndex, totalChunks) {
  const chunkNote = totalChunks > 1
    ? `This is chunk ${chunkIndex + 1} of ${totalChunks}. Extract ONLY the transactions visible in this chunk.\n\n`
    : "";
  return chunkNote +
    "You are a bank statement parser. Extract ALL transactions from the text below.\n" +
    "Return ONLY a valid JSON array — no markdown, no explanation, no preamble.\n" +
    "Each object: {\"date\":\"YYYY-MM-DD\",\"description\":\"original transaction text\",\"vendor\":\"clean merchant name e.g. Amazon, Carrefour, Netflix\",\"amount\":number,\"isCredit\":boolean}\n\n" +
    "For vendor: extract the clean merchant/payee name — strip bank prefixes (IAP-, NFC-, AP-PAY-), card numbers, city/country suffixes like 'Dubai AE', and reference numbers. If no clear merchant, use empty string.\n\n" +
    "RULES:\n" +
    "- isCredit:true for incoming money (salary, refunds, cashback, transfers in)\n" +
    "- isCredit:false for expenses and outgoing transfers\n" +
    "- amount: ONLY the transaction amount column — NEVER use the running balance column\n" +
    "- The running balance is the large cumulative number on the right — IGNORE IT\n" +
    "- dates: use the transaction date (leftmost). Convert to YYYY-MM-DD.\n" +
    "  Examples: '27Feb2026'=2026-02-27, '28-Jan-26'=2026-01-28, '28/01/26'=2026-01-28\n" +
    "  Two-digit years: 24=2024, 25=2025, 26=2026\n" +
    "- Skip rows: 'BALANCE BROUGHT FORWARD', 'OPENING BALANCE', 'CLOSING BALANCE', headers\n" +
    "- HSBC current account: 'Deposits' column = isCredit:true, 'Withdrawals' column = isCredit:false\n" +
    "- Strip prefixes: IAP-, NFC-, AP-PAY-, card numbers, city/country suffixes like 'Dubai AE'\n" +
    "- Output COMPLETE JSON only. Never truncate. If the array would be long, still output all items.\n\n" +
    "STATEMENT TEXT:\n" + chunkText;
}

function parseGeminiResponse(raw, chunkIndex) {
  const clean = raw.replace(/```json|```/g, "").trim();
  try { const parsed = JSON.parse(clean); if (Array.isArray(parsed)) return parsed; } catch (e) {}
  const arrayStart = clean.indexOf("[");
  if (arrayStart === -1) return [];
  const arrayText = clean.slice(arrayStart);
  try { const parsed = JSON.parse(arrayText); if (Array.isArray(parsed)) return parsed; } catch (e) {}
  const objects = [];
  const objRegex = /\{[^{}]*"date"\s*:\s*"[^"]*"[^{}]*"description"\s*:\s*"[^"]*"[^{}]*"amount"\s*:\s*[\d.]+[^{}]*"isCredit"\s*:\s*(?:true|false)[^{}]*\}/g;
  let match;
  while ((match = objRegex.exec(arrayText)) !== null) {
    try { const obj = JSON.parse(match[0]); objects.push(obj); } catch (e) {}
  }
  if (objects.length > 0) console.log(`Chunk ${chunkIndex}: recovered ${objects.length} objects from truncated response`);
  return objects;
}

function deduplicate(allTxs) {
  const seen = new Set();
  return allTxs.filter(function(t) {
    const key = (t.date || "") + "|" + (t.description || "") + "|" + (t.amount || 0);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

functions.http("parseStatement", async function(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST")    { res.status(405).json({ error: "Method not allowed" }); return; }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.replace("Bearer ", "");
  if (!idToken) { res.status(401).json({ error: "Missing auth token" }); return; }
  try { await admin.auth().verifyIdToken(idToken); }
  catch (e) { res.status(401).json({ error: "Invalid auth token" }); return; }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  try {
    const body = req.body;

    // ── SCREENSHOT MODE ──
    if (body.images && body.images.length > 0) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("X-Accel-Buffering", "no");
      function streamS(obj) { res.write(JSON.stringify(obj) + "\n"); }
      streamS({ log: `Reading ${body.images.length} screenshot${body.images.length===1?"":"s"} with Gemini…` });
      const parts = body.images.map(function(img) {
        return { inlineData: { mimeType: img.mediaType, data: img.base64 } };
      });
      parts.push({ text: "Extract all transactions from these bank statement screenshots. " +
        "Return ONLY a JSON array: [{\"date\":\"YYYY-MM-DD\",\"description\":\"original transaction text\",\"vendor\":\"clean merchant name e.g. Amazon, Carrefour, Netflix\",\"amount\":number,\"isCredit\":boolean}]. " +
        "For vendor: extract the clean merchant/payee name — strip bank prefixes, card numbers, city/country suffixes. If no clear merchant, use empty string." });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts }],
        config: { maxOutputTokens: 16384, temperature: 0.1 }
      });
      const raw = response.text || "";
      const transactions = parseGeminiResponse(raw, 0);
      streamS({ done: true, transactions, piiReport: { count: 0, types: {}, samples: [] }, chunks: 1 });
      res.end();
      return;
    }

    // ── DESCRIPTION SUGGESTION MODE (spreadsheet vendor enrichment) ──
    if (body.descriptionList && Array.isArray(body.descriptionList)) {
      const descs = body.descriptionList.slice(0, 200); // safety cap
      const prompt =
        "You are a bank transaction categoriser. For each transaction description below, return a clean vendor name.\n" +
        "Return ONLY a valid JSON array — no markdown, no explanation, no preamble.\n" +
        "Each element must be an object with these fields:\n" +
        "  \"description\": the exact input description (copy it verbatim)\n" +
        "  \"vendor\": a clean short company/payee name — ALWAYS required, never omit\n" +
        "  \"category\": only include if obvious (e.g. \"Groceries\", \"Transport\", \"Utilities\", \"Salary\") — otherwise omit this field\n" +
        "Rules for vendor:\n" +
        "- Strip bank prefixes, reference codes, timestamps, card numbers, location noise\n" +
        "- ATM withdrawals → \"ATM Withdrawal\"\n" +
        "- Transfer/payment references → use the recipient name if identifiable, else \"Bank Transfer\"\n" +
        "- If you cannot identify a specific vendor, use the most meaningful word(s) from the description\n" +
        "- Never return an empty string or null for vendor\n" +
        "- Examples: \"CARD TRANSACTION 19MAR26 ATMA311...\" → \"ATM Withdrawal\", \"AMAZON EU SARL\" → \"Amazon\", \"CARREFOUR CITY\" → \"Carrefour\"\n" +
        "You MUST return exactly " + descs.length + " objects in the array, one per input description, in the same order.\n\n" +
        "DESCRIPTIONS:\n" + descs.map(function(d,i){ return (i+1)+". "+d; }).join("\n");

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 8192, temperature: 0, responseMimeType: "application/json" }
      });
      const raw = response.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      let suggestions = [];
      try { suggestions = JSON.parse(clean); } catch(e) {
        const arrayStart = clean.indexOf("[");
        if(arrayStart !== -1) try { suggestions = JSON.parse(clean.slice(arrayStart)); } catch(e2) {}
      }
      res.json({ suggestions: Array.isArray(suggestions) ? suggestions : [] });
      return;
    }

    // ── SPREADSHEET MODE ──
    if (body.spreadsheetText) {
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("X-Accel-Buffering", "no");
      function streamX(obj) { res.write(JSON.stringify(obj) + "\n"); }

      const allRows = body.spreadsheetText.split("\n").filter(function(r) { return r.trim(); });

      // First row is the user-added header (e.g. "Date | Transaction Detail | Amount")
      // If no header detected (first row looks like a date), treat all rows as data
      const firstRowLooksLikeData = /^\d{1,2}[\/\-]/.test(allRows[0]);
      const headerRow = firstRowLooksLikeData ? null : allRows[0];
      const dataRows = firstRowLooksLikeData ? allRows : allRows.slice(1);

      const XLS_CHUNK = 40;
      const totalChunks = Math.ceil(dataRows.length / XLS_CHUNK);
      streamX({ log: `Processing ${dataRows.length} rows in ${totalChunks} section${totalChunks===1?"":"s"}…` });

      let allXlsTxs = [];
      for (var ci = 0; ci < dataRows.length; ci += XLS_CHUNK) {
        const chunkRows = dataRows.slice(ci, ci + XLS_CHUNK);
        const chunkNum = Math.floor(ci / XLS_CHUNK) + 1;
        // Inject header at top of every chunk so Gemini has column context
        const segmentText = headerRow
          ? [headerRow, ...chunkRows].join("\n")
          : chunkRows.join("\n");

        streamX({ log: `Section ${chunkNum}/${totalChunks}: rows ${ci+1}–${ci+chunkRows.length}…` });

        const prompt =
          "You are a precise data converter for bank statement rows.\n" +
          (headerRow ? `Column headers: ${headerRow}\n` : "Columns: Date | Description | Amount\n") +
          "Convert EVERY data row into a JSON object. Return ONLY a valid JSON array — no markdown.\n" +
          "Each object: {\"date\":\"YYYY-MM-DD\",\"description\":\"clean merchant name\",\"amount\":number,\"isCredit\":boolean}\n" +
          `Expected: exactly ${chunkRows.length} objects.\n` +
          "- amount: always positive\n" +
          "- isCredit: true if amount was positive/credit, false if negative/debit\n" +
          "- date: convert to YYYY-MM-DD\n\n" +
          "DATA:\n" + segmentText;

        try {
          let chunkTxs = [];
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { maxOutputTokens: 16384, temperature: 0 }
          });
          chunkTxs = parseGeminiResponse(response.text || "", ci);
          console.log(`XLS section ${chunkNum}: ${chunkTxs.length}/${chunkRows.length} rows`);
          if (chunkTxs.length < chunkRows.length * 0.7) {
            streamX({ log: `Section ${chunkNum}/${totalChunks}: only ${chunkTxs.length}/${chunkRows.length} — retrying…` });
            const retry = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              config: { maxOutputTokens: 16384, temperature: 0 }
            });
            const retryTxs = parseGeminiResponse(retry.text || "", ci);
            console.log(`XLS section ${chunkNum} retry: ${retryTxs.length}/${chunkRows.length} rows`);
            if (retryTxs.length > chunkTxs.length) chunkTxs = retryTxs;
          }
          streamX({ log: `Section ${chunkNum}/${totalChunks}: found ${chunkTxs.length} transaction${chunkTxs.length===1?"":"s"}` });
          allXlsTxs = allXlsTxs.concat(chunkTxs);
        } catch (e) {
          console.log(`XLS section ${chunkNum} error:`, e.message);
          streamX({ log: `Section ${chunkNum}/${totalChunks}: error — ${e.message}` });
        }
      }

      const xlsFinal = deduplicate(allXlsTxs);
      console.log(`XLS total: ${xlsFinal.length} (before dedup: ${allXlsTxs.length})`);
      streamX({ done: true, transactions: xlsFinal, piiReport: { count: 0, types: {}, samples: [] }, chunks: totalChunks });
      res.end();
      return;
    }

    // ── PDF MODE ──
    if (!body.pdfBase64) { res.status(400).json({ error: "No input provided" }); return; }

    const pdfBuffer = Buffer.from(body.pdfBase64, "base64");
    console.log(`PDF: ${Math.round(pdfBuffer.length / 1024)}KB, model: ${GEMINI_MODEL}`);

    let extractedText = "";
    let piiReport = { count: 0, types: {}, samples: [] };
    let useDirectPdf = false;

    try {
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text || "";
      console.log(`Extracted: ${extractedText.length} chars, ${pdfData.numpages} pages`);
      const latinChars  = (extractedText.match(/[a-zA-Z0-9.,\s]/g) || []).length;
      const latinRatio  = extractedText.length > 0 ? latinChars / extractedText.length : 0;
      const hasAmounts  = /\d{1,3}[,.]?\d{3}/.test(extractedText);
      const textUsable  = latinRatio >= 0.35 && hasAmounts;
      console.log(`Text usable: ${textUsable} (latin: ${(latinRatio * 100).toFixed(1)}%, amounts: ${hasAmounts})`);
      if (!textUsable) {
        useDirectPdf = true;
      } else {
        const scrubbed = scrubPII(extractedText);
        extractedText = scrubbed.text;
        piiReport = scrubbed.piiReport;
        console.log(`Text mode: PII scrubbed ${piiReport.count} items, ${piiReport.samples.length} samples`);
      }
    } catch (e) {
      console.log("pdf-parse failed, falling back to direct PDF mode:", e.message);
      useDirectPdf = true;
    }

    if (useDirectPdf) {
      console.log("Direct PDF mode: sending raw PDF to Gemini");
      const parts = [
        { inlineData: { mimeType: "application/pdf", data: body.pdfBase64 } },
        { text: "Extract all transactions from this bank statement PDF.\n" +
          "Return ONLY a JSON array: [{\"date\":\"YYYY-MM-DD\",\"description\":\"original transaction text\",\"vendor\":\"clean merchant name e.g. Amazon, Carrefour, Netflix\",\"amount\":number,\"isCredit\":boolean}]\n" +
          "For vendor: extract the clean merchant/payee name — strip bank prefixes (IAP-, NFC-, AP-PAY-), card numbers, city/country suffixes. If no clear merchant, use empty string.\n" +
          "- amount: use the transaction amount only, never the running balance\n" +
          "- isCredit:true for deposits/credits/incoming transfers\n" +
          "- isCredit:false for withdrawals/payments/debits\n" +
          "- Skip balance rows, header rows, opening/closing balance rows\n" +
          "- Output COMPLETE JSON. Never truncate." }
      ];
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts }],
        config: { maxOutputTokens: 16384, temperature: 0.1 }
      });
      const raw = response.text || "";
      const transactions = parseGeminiResponse(raw, 0);
      console.log(`Direct PDF mode: ${transactions.length} transactions`);
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("X-Accel-Buffering", "no");
      res.write(JSON.stringify({ log: `Direct PDF mode: ${transactions.length} transactions found` }) + "\n");
      res.write(JSON.stringify({ done: true, transactions, piiReport: { count: 0, types: {}, samples: [], warning: "Direct PDF mode: PII scrubbing not available" }, chunks: 1 }) + "\n");
      res.end();
      return;
    }

    const chunks = splitIntoChunks(extractedText, CHUNK_SIZE);
    console.log(`Text mode: ${chunks.length} chunks`);
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Accel-Buffering", "no");
    function stream(obj) { res.write(JSON.stringify(obj) + "\n"); }
    stream({ log: `PDF: ${Math.round(pdfBuffer.length/1024)}KB · ${chunks.length} sections · PII scrubbed ${piiReport.count} items` });

    let allTransactions = [];
    for (let i = 0; i < chunks.length; i++) {
      stream({ log: `Section ${i+1}/${chunks.length}: reading ${chunks[i].length} chars…` });
      const prompt = buildPrompt(chunks[i], i, chunks.length);
      let chunkTxs = [];
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { maxOutputTokens: 16384, temperature: 0.1 }
        });
        const raw = response.text || "";
        chunkTxs = parseGeminiResponse(raw, i);
        console.log(`Text chunk ${i + 1}: ${chunkTxs.length} transactions`);
        stream({ log: `Section ${i+1}/${chunks.length}: found ${chunkTxs.length} transaction${chunkTxs.length===1?"":"s"}` });
      } catch (e) {
        console.log(`Chunk ${i + 1} error:`, e.message);
        stream({ log: `Section ${i+1}/${chunks.length}: error — ${e.message}` });
      }
      allTransactions = allTransactions.concat(chunkTxs);
    }

    const deduplicated = deduplicate(allTransactions);
    console.log(`Total: ${deduplicated.length} transactions (before dedup: ${allTransactions.length})`);

    if (deduplicated.length === 0) {
      stream({ log: "No transactions found in text — trying direct PDF mode…" });
      const parts = [
        { inlineData: { mimeType: "application/pdf", data: body.pdfBase64 } },
        { text: "Extract all transactions from this bank statement PDF.\n" +
          "Return ONLY a JSON array: [{\"date\":\"YYYY-MM-DD\",\"description\":\"original transaction text\",\"vendor\":\"clean merchant name e.g. Amazon, Carrefour, Netflix\",\"amount\":number,\"isCredit\":boolean}]\n" +
          "For vendor: extract the clean merchant/payee name — strip bank prefixes, card numbers, city/country suffixes. If no clear merchant, use empty string.\n" +
          "- amount: use the transaction amount only, never the running balance\n" +
          "- isCredit:true for deposits/credits/incoming\n" +
          "- isCredit:false for withdrawals/debits\n" +
          "- Skip balance rows, header rows\n" +
          "- Output COMPLETE JSON. Never truncate." }
      ];
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts }],
        config: { maxOutputTokens: 16384, temperature: 0.1 }
      });
      const raw = response.text || "";
      const fallbackTxs = parseGeminiResponse(raw, 0);
      stream({ log: `Direct PDF mode: ${fallbackTxs.length} transactions found` });
      stream({ done: true, transactions: fallbackTxs, piiReport: { count:0, types:{}, samples:[], warning:"Direct PDF mode — PII scrubbing not available" }, chunks: 1 });
      res.end();
      return;
    }

    stream({ done: true, transactions: deduplicated, piiReport, chunks: chunks.length });
    res.end();

  } catch (e) {
    console.error("parseStatement error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});
