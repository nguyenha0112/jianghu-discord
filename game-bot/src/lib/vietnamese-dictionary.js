const { getCachedDictionaryPhrase, setCachedDictionaryPhrase } = require("../storage/word-chain-dictionary-cache-store");

const DICTIONARY_LOOKUP_URL = process.env.DICT_LOOKUP_URL || "https://dict.minhqnd.com/api/v1/lookup";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function normalizeDictionaryPhrase(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function splitTokens(input) {
  return normalizeDictionaryPhrase(input).split(" ").filter(Boolean);
}

function isCacheFresh(entry) {
  if (!entry?.updatedAt) {
    return false;
  }

  const updatedAt = new Date(entry.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt < CACHE_TTL_MS;
}

function extractVietnameseMeanings(payload) {
  return (payload?.results || [])
    .filter((result) => result.lang_code === "vi")
    .flatMap((result) => result.meanings || [])
    .filter((meaning) => meaning.definition_lang === "vi" && typeof meaning.definition === "string" && meaning.definition.trim().length > 0);
}

function isAcceptableDictionaryPhrase(normalizedPhrase, payload) {
  if (splitTokens(normalizedPhrase).length !== 2) {
    return false;
  }

  if (!payload?.exists) {
    return false;
  }

  return extractVietnameseMeanings(payload).length > 0;
}

async function lookupVietnameseDictionary(rawPhrase) {
  const normalizedPhrase = normalizeDictionaryPhrase(rawPhrase);
  if (splitTokens(normalizedPhrase).length !== 2) {
    return {
      phrase: normalizedPhrase,
      exists: false,
      accepted: false,
      source: "rule"
    };
  }

  const cached = getCachedDictionaryPhrase(normalizedPhrase);
  if (cached && isCacheFresh(cached)) {
    return cached;
  }

  try {
    const url = `${DICTIONARY_LOOKUP_URL}?word=${encodeURIComponent(normalizedPhrase)}&lang=vi&def_lang=vi`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 404) {
      return setCachedDictionaryPhrase(normalizedPhrase, {
        exists: false,
        accepted: false,
        source: "dict.minhqnd.com",
        meanings: []
      });
    }

    if (!response.ok) {
      throw new Error(`Dictionary lookup failed with status ${response.status}`);
    }

    const payload = await response.json();
    const meanings = extractVietnameseMeanings(payload).map((meaning) => ({
      definition: meaning.definition,
      pos: meaning.pos || null,
      source: meaning.source || null
    }));

    return setCachedDictionaryPhrase(normalizedPhrase, {
      exists: Boolean(payload.exists),
      accepted: isAcceptableDictionaryPhrase(normalizedPhrase, payload),
      source: "dict.minhqnd.com",
      meanings
    });
  } catch (error) {
    return cached || {
      phrase: normalizedPhrase,
      exists: false,
      accepted: false,
      source: "dictionary-error",
      error: error.message
    };
  }
}

module.exports = {
  lookupVietnameseDictionary,
  normalizeDictionaryPhrase
};
