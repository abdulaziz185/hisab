/**
 * hisab-ai.js
 * Drop-in Free AI & Smart Typo-Matcher for Hisab AI
 * 
 * How to add to your GitHub repo:
 * 1. Upload this file (hisab-ai.js) to your GitHub repository root.
 * 2. Add <script src="hisab-ai.js"></script> inside your index.html right before </body>.
 * 3. Call HisabAI.parse(userInput, existingAccountNames) when processing messages.
 */

window.HisabAI = (function () {
  // Known custom aliases for your shop
  const DEFAULT_ALIASES = {
    shahge: "Shahgee",
    shahgee: "Shahgee",
    shahjee: "Shahgee",
    shaji: "Shahgee",
    kazmi: "Kazmi",
    kazmie: "Kazmi",
  };

  /**
   * Levenshtein distance for offline typo matching
   */
  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  /**
   * Resolves capitalization and spelling typos (e.g., "KAZMI", "kazmi", "shahge")
   * against existing accounts in your ledger.
   */
  function resolveAccountName(rawName, existingAccounts = []) {
    if (!rawName || typeof rawName !== "string") return "";
    const clean = rawName.trim().toLowerCase();
    if (!clean) return "";

    // 1. Check explicit alias list first
    if (DEFAULT_ALIASES[clean]) {
      const aliasTarget = DEFAULT_ALIASES[clean];
      const existingAlias = existingAccounts.find(
        (acc) => acc.toLowerCase() === aliasTarget.toLowerCase()
      );
      return existingAlias || aliasTarget;
    }

    // 2. Exact case-insensitive match ("KAZMI" -> "Kazmi")
    const exact = existingAccounts.find((acc) => acc.toLowerCase() === clean);
    if (exact) return exact;

    // 3. Fuzzy similarity match (>= 70% similar -> catches "shahge" for "Shahgee")
    let bestMatch = null;
    let bestScore = 0;

    for (const acc of existingAccounts) {
      const target = acc.toLowerCase();
      const dist = levenshtein(clean, target);
      const maxLen = Math.max(clean.length, target.length);
      const similarity = (maxLen - dist) / maxLen;

      if (similarity >= 0.7 && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = acc;
      }
    }

    if (bestMatch) return bestMatch;

    // 4. New account: Title Case
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Free AI Parser using Pollinations.ai (No API key or signup required)
   * Automatically falls back to offline account resolution if offline/rate-limited.
   */
  async function parseMessage(userMessage, existingAccounts = []) {
    const prompt = `You are a Pakistani mobile shop ledger assistant (Hisab AI).
Existing accounts: ${JSON.stringify(existingAccounts)}
User message: "${userMessage}"

Rules:
1. Match any person's name to an existing account if it's a typo or case difference (e.g., "shahge", "ShahGee" -> "Shahgee"; "KAZMI", "kazmi" -> "Kazmi").
2. Identify action: "sale_udhaar" (credit sale), "sale_cash" (cash sale), "payment_received" (e.g. "ne 150 diye"), "query_balance" (e.g. "kitna?", "udhaar"), "query_sales" (e.g. "aaj ki sale"), or "undo".
3. Extract item name, quantity, and amount in PKR.

Reply ONLY with valid JSON:
{"action":"sale_udhaar|sale_cash|payment_received|query_balance|query_sales|undo","account":"Standardized Name or null","item":"Item or null","qty":1,"amount":0}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "openai",
          messages: [{ role: "user", content: prompt }],
          jsonMode: true,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error("AI endpoint busy");

      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);

      // Double-check account name through local resolver to guarantee 100% consistency
      if (parsed.account) {
        parsed.account = resolveAccountName(parsed.account, existingAccounts);
      }

      return { ok: true, source: "ai", data: parsed };
    } catch (err) {
      // Fallback signal so your existing local parser can handle it offline
      return { ok: false, source: "offline", error: err.message };
    }
  }

  return {
    resolveAccountName,
    parseMessage,
  };
})();
