import wordDictionary from "../data/wordDictionary.json";
import glossary from "../data/glossary.json";
import commonPhrases from "../data/commonPhrases.json";
import translationMemory from "../data/translationMemory.json";

// =============================
// NORMALIZACIÓN Y UTILIDADES
// =============================

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function cleanSpaces(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([¿¡])\s+/g, "$1")
    .trim();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalizeFirst(text) {
  const value = String(text || "");
  if (!value) return value;
  return value.replace(/^([¿¡"']?)(\p{L})/u, (_match, prefix, letter) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

function numberToLetters(index) {
  let value = Number(index) + 1;
  let result = "";

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result;
}

function preserveFinalPunctuation(original, translated) {
  const originalTrim = String(original || "").trim();
  let result = String(translated || "").trim();

  if (!result) return result;

  const originalPunct = originalTrim.match(/[.!?]+$/)?.[0] || "";
  const translatedPunct = result.match(/[.!?]+$/)?.[0] || "";

  if (originalPunct && !translatedPunct) {
    result += originalPunct;
  }

  return result;
}

function tokenize(text) {
  return String(text || "").match(/[\p{L}]+(?:'[\p{L}]+)?|[0-9]+|[^\s\p{L}0-9]/gu) || [];
}

function isWordToken(token) {
  return /^[\p{L}]+(?:'[\p{L}]+)?$/u.test(token);
}

function joinTokens(tokens) {
  let result = "";

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const prev = tokens[i - 1];

    const noSpaceBefore = /^[.,!?;:)\]]$/.test(token);
    const noSpaceAfterPrev = /^[¿¡(\[]$/.test(prev || "");

    if (i === 0 || noSpaceBefore || noSpaceAfterPrev) {
      result += token;
    } else {
      result += " " + token;
    }
  }

  return cleanSpaces(result);
}

// =============================
// RECURSOS BASE
// =============================

const PRONOUN_TRANSLATIONS = {
  i: "yo",
  you: "tú",
  he: "él",
  she: "ella",
  it: "eso",
  we: "nosotros",
  they: "ellos",
  me: "me",
  him: "lo",
  her: "la",
  us: "nos",
  them: "los",
  my: "mi",
  your: "tu",
  his: "su",
  our: "nuestro",
  their: "su"
};

const AUXILIARY_MAP = {
  am: "estoy",
  is: "está",
  are: "están",
  was: "estaba",
  were: "estaban",
  have: "tengo",
  has: "tiene",
  had: "tenía",
  do: "hago",
  does: "hace",
  did: "hizo",
  can: "puedo",
  could: "podía",
  will: "haré",
  would: "haría",
  should: "debería",
  must: "debo",
  may: "puede",
  might: "podría"
};

const NEGATION_PATTERNS = [
  { pattern: /\bi do not\b/gi, replace: "yo no" },
  { pattern: /\bi don't\b/gi, replace: "yo no" },
  { pattern: /\byou do not\b/gi, replace: "tú no" },
  { pattern: /\byou don't\b/gi, replace: "tú no" },
  { pattern: /\bhe does not\b/gi, replace: "él no" },
  { pattern: /\bhe doesn't\b/gi, replace: "él no" },
  { pattern: /\bshe does not\b/gi, replace: "ella no" },
  { pattern: /\bshe doesn't\b/gi, replace: "ella no" },
  { pattern: /\bwe do not\b/gi, replace: "nosotros no" },
  { pattern: /\bwe don't\b/gi, replace: "nosotros no" },
  { pattern: /\bthey do not\b/gi, replace: "ellos no" },
  { pattern: /\bthey don't\b/gi, replace: "ellos no" },

  { pattern: /\bi cannot\b/gi, replace: "no puedo" },
  { pattern: /\bi can't\b/gi, replace: "no puedo" },
  { pattern: /\byou cannot\b/gi, replace: "no puedes" },
  { pattern: /\byou can't\b/gi, replace: "no puedes" },
  { pattern: /\bhe cannot\b/gi, replace: "no puede" },
  { pattern: /\bhe can't\b/gi, replace: "no puede" },
  { pattern: /\bshe cannot\b/gi, replace: "no puede" },
  { pattern: /\bshe can't\b/gi, replace: "no puede" },
  { pattern: /\bwe cannot\b/gi, replace: "no podemos" },
  { pattern: /\bwe can't\b/gi, replace: "no podemos" },
  { pattern: /\bthey cannot\b/gi, replace: "no pueden" },
  { pattern: /\bthey can't\b/gi, replace: "no pueden" },

  { pattern: /\bi will not\b/gi, replace: "no haré" },
  { pattern: /\bi won't\b/gi, replace: "no haré" },
  { pattern: /\byou will not\b/gi, replace: "no harás" },
  { pattern: /\byou won't\b/gi, replace: "no harás" },
  { pattern: /\bhe will not\b/gi, replace: "no hará" },
  { pattern: /\bhe won't\b/gi, replace: "no hará" },
  { pattern: /\bshe will not\b/gi, replace: "no hará" },
  { pattern: /\bshe won't\b/gi, replace: "no hará" },
  { pattern: /\bwe will not\b/gi, replace: "no haremos" },
  { pattern: /\bwe won't\b/gi, replace: "no haremos" },
  { pattern: /\bthey will not\b/gi, replace: "no harán" },
  { pattern: /\bthey won't\b/gi, replace: "no harán" },

  { pattern: /\bis not\b/gi, replace: "no está" },
  { pattern: /\bisn't\b/gi, replace: "no está" },
  { pattern: /\bare not\b/gi, replace: "no están" },
  { pattern: /\baren't\b/gi, replace: "no están" },
  { pattern: /\bwas not\b/gi, replace: "no estaba" },
  { pattern: /\bwasn't\b/gi, replace: "no estaba" },
  { pattern: /\bwere not\b/gi, replace: "no estaban" },
  { pattern: /\bweren't\b/gi, replace: "no estaban" }
];

const SUBJECT_VERB_PATTERNS = [
  { pattern: /\bi am\b/gi, replace: "yo estoy" },
  { pattern: /\byou are\b/gi, replace: "tú estás" },
  { pattern: /\bhe is\b/gi, replace: "él está" },
  { pattern: /\bshe is\b/gi, replace: "ella está" },
  { pattern: /\bit is\b/gi, replace: "eso es" },
  { pattern: /\bwe are\b/gi, replace: "nosotros estamos" },
  { pattern: /\bthey are\b/gi, replace: "ellos están" },

  { pattern: /\bi have\b/gi, replace: "yo tengo" },
  { pattern: /\byou have\b/gi, replace: "tú tienes" },
  { pattern: /\bhe has\b/gi, replace: "él tiene" },
  { pattern: /\bshe has\b/gi, replace: "ella tiene" },
  { pattern: /\bwe have\b/gi, replace: "nosotros tenemos" },
  { pattern: /\bthey have\b/gi, replace: "ellos tienen" },

  { pattern: /\bi can\b/gi, replace: "yo puedo" },
  { pattern: /\byou can\b/gi, replace: "tú puedes" },
  { pattern: /\bhe can\b/gi, replace: "él puede" },
  { pattern: /\bshe can\b/gi, replace: "ella puede" },
  { pattern: /\bwe can\b/gi, replace: "nosotros podemos" },
  { pattern: /\bthey can\b/gi, replace: "ellos pueden" }
];

const VERB_BASE_MAP = {
  be: "ser",
  have: "tener",
  do: "hacer",
  go: "ir",
  come: "venir",
  know: "saber",
  want: "querer",
  need: "necesitar",
  let: "dejar",
  die: "morir",
  live: "vivir",
  fight: "luchar",
  run: "correr",
  leave: "dejar",
  protect: "proteger",
  save: "salvar",
  kill: "matar",
  stop: "detener",
  help: "ayudar",
  wait: "esperar",
  hurry: "apresurarse",
  give: "dar",
  take: "tomar",
  stand: "estar",
  chance: "oportunidad",
  look: "mirar",
  find: "encontrar",
  think: "pensar",
  believe: "creer",
  see: "ver",
  hear: "oír",
  tell: "decir",
  call: "llamar",
  use: "usar",
  try: "intentar",
  hold: "sostener",
  move: "mover",
  attack: "atacar",
  defend: "defender"
};

const CONTRACTION_PATTERNS = [
  { pattern: /\bi'm\b/gi, replace: "I am" },
  { pattern: /\byou're\b/gi, replace: "you are" },
  { pattern: /\bhe's\b/gi, replace: "he is" },
  { pattern: /\bshe's\b/gi, replace: "she is" },
  { pattern: /\bit's\b/gi, replace: "it is" },
  { pattern: /\bwe're\b/gi, replace: "we are" },
  { pattern: /\bthey're\b/gi, replace: "they are" },
  { pattern: /\bi've\b/gi, replace: "I have" },
  { pattern: /\byou've\b/gi, replace: "you have" },
  { pattern: /\bwe've\b/gi, replace: "we have" },
  { pattern: /\bthey've\b/gi, replace: "they have" },
  { pattern: /\bi'll\b/gi, replace: "I will" },
  { pattern: /\byou'll\b/gi, replace: "you will" },
  { pattern: /\bhe'll\b/gi, replace: "he will" },
  { pattern: /\bshe'll\b/gi, replace: "she will" },
  { pattern: /\bwe'll\b/gi, replace: "we will" },
  { pattern: /\bthey'll\b/gi, replace: "they will" },
  { pattern: /\bi'd\b/gi, replace: "I would" },
  { pattern: /\byou'd\b/gi, replace: "you would" },
  { pattern: /\bhe'd\b/gi, replace: "he would" },
  { pattern: /\bshe'd\b/gi, replace: "she would" },
  { pattern: /\bwe'd\b/gi, replace: "we would" },
  { pattern: /\bthey'd\b/gi, replace: "they would" }
];

const VERB_ING_MAP = {
  coming: "viniendo",
  going: "yendo",
  doing: "haciendo",
  fighting: "luchando",
  running: "corriendo",
  leaving: "yendo",
  protecting: "protegiendo",
  saving: "salvando",
  killing: "matando",
  stopping: "deteniendo",
  helping: "ayudando",
  waiting: "esperando",
  giving: "dando",
  taking: "tomando",
  looking: "mirando",
  finding: "encontrando",
  thinking: "pensando",
  believing: "creyendo",
  seeing: "viendo",
  hearing: "oyendo",
  telling: "diciendo",
  calling: "llamando",
  using: "usando",
  trying: "intentando",
  holding: "sosteniendo",
  moving: "moviendo",
  attacking: "atacando",
  defending: "defendiendo"
};

const VERB_PAST_MAP = {
  came: "vino",
  went: "fue",
  did: "hizo",
  fought: "luchó",
  ran: "corrió",
  left: "se fue",
  protected: "protegió",
  saved: "salvó",
  killed: "mató",
  stopped: "detuvo",
  helped: "ayudó",
  waited: "esperó",
  gave: "dio",
  took: "tomó",
  looked: "miró",
  found: "encontró",
  thought: "pensó",
  believed: "creyó",
  saw: "vio",
  heard: "oyó",
  told: "dijo",
  called: "llamó",
  used: "usó",
  tried: "intentó",
  held: "sostuvo",
  moved: "movió",
  attacked: "atacó",
  defended: "defendió"
};

const BASIC_WORD_OVERRIDES = {
  now: "ahora",
  here: "aquí",
  there: "allí",
  today: "hoy",
  tomorrow: "mañana",
  yesterday: "ayer",
  always: "siempre",
  never: "nunca",
  maybe: "quizá",
  really: "realmente",
  only: "solo",
  again: "otra vez"
};

const SUBJECT_FORMS = {
  i: {
    pronoun: "yo",
    estar: "estoy",
    tenerQue: "tengo que",
    querer: "quiero",
    necesitar: "necesito",
    poder: "puedo",
    poderNo: "no puedo",
    pastSuffix: "yo"
  },
  you: {
    pronoun: "tú",
    estar: "estás",
    tenerQue: "tienes que",
    querer: "quieres",
    necesitar: "necesitas",
    poder: "puedes",
    poderNo: "no puedes",
    pastSuffix: "tu"
  },
  he: {
    pronoun: "él",
    estar: "está",
    tenerQue: "tiene que",
    querer: "quiere",
    necesitar: "necesita",
    poder: "puede",
    poderNo: "no puede",
    pastSuffix: "el"
  },
  she: {
    pronoun: "ella",
    estar: "está",
    tenerQue: "tiene que",
    querer: "quiere",
    necesitar: "necesita",
    poder: "puede",
    poderNo: "no puede",
    pastSuffix: "el"
  },
  it: {
    pronoun: "eso",
    estar: "está",
    tenerQue: "tiene que",
    querer: "quiere",
    necesitar: "necesita",
    poder: "puede",
    poderNo: "no puede",
    pastSuffix: "el"
  },
  we: {
    pronoun: "nosotros",
    estar: "estamos",
    tenerQue: "tenemos que",
    querer: "queremos",
    necesitar: "necesitamos",
    poder: "podemos",
    poderNo: "no podemos",
    pastSuffix: "nosotros"
  },
  they: {
    pronoun: "ellos",
    estar: "están",
    tenerQue: "tienen que",
    querer: "quieren",
    necesitar: "necesitan",
    poder: "pueden",
    poderNo: "no pueden",
    pastSuffix: "ellos"
  }
};

const OBJECT_FORMS = {
  me: "me",
  you: "te",
  him: "lo",
  her: "la",
  us: "nos",
  them: "los",
  it: "lo"
};

const COMMON_VERBS = {
  protect: {
    infinitive: "proteger",
    gerund: "protegiendo",
    future: {
      i: "protegeré",
      you: "protegerás",
      he: "protegerá",
      she: "protegerá",
      it: "protegerá",
      we: "protegeremos",
      they: "protegerán"
    },
    past: {
      i: "protegí",
      you: "protegiste",
      he: "protegió",
      she: "protegió",
      it: "protegió",
      we: "protegimos",
      they: "protegieron"
    }
  },
  save: {
    infinitive: "salvar",
    gerund: "salvando",
    future: {
      i: "salvaré",
      you: "salvarás",
      he: "salvará",
      she: "salvará",
      it: "salvará",
      we: "salvaremos",
      they: "salvarán"
    },
    past: {
      i: "salvé",
      you: "salvaste",
      he: "salvó",
      she: "salvó",
      it: "salvó",
      we: "salvamos",
      they: "salvaron"
    }
  },
  kill: {
    infinitive: "matar",
    gerund: "matando",
    future: {
      i: "mataré",
      you: "matarás",
      he: "matará",
      she: "matará",
      it: "matará",
      we: "mataremos",
      they: "matarán"
    },
    past: {
      i: "maté",
      you: "mataste",
      he: "mató",
      she: "mató",
      it: "mató",
      we: "matamos",
      they: "mataron"
    }
  },
  stop: {
    infinitive: "detener",
    gerund: "deteniendo",
    future: {
      i: "detendré",
      you: "detendrás",
      he: "detendrá",
      she: "detendrá",
      it: "detendrá",
      we: "detendremos",
      they: "detendrán"
    },
    past: {
      i: "detuve",
      you: "detuviste",
      he: "detuvo",
      she: "detuvo",
      it: "detuvo",
      we: "detuvimos",
      they: "detuvieron"
    }
  },
  help: {
    infinitive: "ayudar",
    gerund: "ayudando",
    future: {
      i: "ayudaré",
      you: "ayudarás",
      he: "ayudará",
      she: "ayudará",
      it: "ayudará",
      we: "ayudaremos",
      they: "ayudarán"
    },
    past: {
      i: "ayudé",
      you: "ayudaste",
      he: "ayudó",
      she: "ayudó",
      it: "ayudó",
      we: "ayudamos",
      they: "ayudaron"
    }
  },
  find: {
    infinitive: "encontrar",
    gerund: "encontrando",
    future: {
      i: "encontraré",
      you: "encontrarás",
      he: "encontrará",
      she: "encontrará",
      it: "encontrará",
      we: "encontraremos",
      they: "encontrarán"
    },
    past: {
      i: "encontré",
      you: "encontraste",
      he: "encontró",
      she: "encontró",
      it: "encontró",
      we: "encontramos",
      they: "encontraron"
    }
  },
  tell: {
    infinitive: "decir",
    gerund: "diciendo",
    future: {
      i: "diré",
      you: "dirás",
      he: "dirá",
      she: "dirá",
      it: "dirá",
      we: "diremos",
      they: "dirán"
    },
    past: {
      i: "dije",
      you: "dijiste",
      he: "dijo",
      she: "dijo",
      it: "dijo",
      we: "dijimos",
      they: "dijeron"
    }
  },
  fight: {
    infinitive: "luchar",
    gerund: "luchando",
    future: {
      i: "lucharé",
      you: "lucharás",
      he: "luchará",
      she: "luchará",
      it: "luchará",
      we: "lucharemos",
      they: "lucharán"
    },
    past: {
      i: "luché",
      you: "luchaste",
      he: "luchó",
      she: "luchó",
      it: "luchó",
      we: "luchamos",
      they: "lucharon"
    }
  },
  trust: {
    infinitive: "confiar",
    objectPreposition: "en",
    gerund: "confiando",
    future: {
      i: "confiaré",
      you: "confiarás",
      he: "confiará",
      she: "confiará",
      it: "confiará",
      we: "confiaremos",
      they: "confiarán"
    },
    past: {
      i: "confié",
      you: "confiaste",
      he: "confió",
      she: "confió",
      it: "confió",
      we: "confiamos",
      they: "confiaron"
    }
  }
};

const PREPOSITIONAL_OBJECT_FORMS = {
  me: "mí",
  you: "ti",
  him: "él",
  her: "ella",
  us: "nosotros",
  them: "ellos",
  it: "eso"
};

const IRREGULAR_PLURALS = {
  men: "hombres",
  women: "mujeres",
  children: "niños",
  people: "personas",
  feet: "pies",
  teeth: "dientes",
  mice: "ratones"
};

const ARTICLES = new Set(["a", "an", "the"]);
const PREPOSITIONS = new Set([
  "to", "of", "for", "with", "at", "from", "into", "on", "in", "by", "about", "after", "before"
]);

// =============================
// GLOSSARY FLATTEN
// =============================

function buildGlossaryMaps() {
  const protectedTerms = {};
  const preferredTranslations = {};
  const blockedLiteralTranslations = {};

  function mergeBlock(block) {
    if (!block || typeof block !== "object") return;

    Object.assign(protectedTerms, block.protectedTerms || {});
    Object.assign(preferredTranslations, block.preferredTranslations || {});
    Object.assign(blockedLiteralTranslations, block.blockedLiteralTranslations || {});
  }

  mergeBlock(glossary);

  for (const value of Object.values(glossary)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      mergeBlock(value);
    }
  }

  return {
    protectedTerms,
    preferredTranslations,
    blockedLiteralTranslations
  };
}

const GLOSSARY_MAPS = buildGlossaryMaps();

// =============================
// 1. TRANSLATION MEMORY
// =============================

function applyTranslationMemory(text) {
  const exact = translationMemory[String(text || "").trim()];
  if (exact) {
    return {
      matched: true,
      text: exact
    };
  }

  return {
    matched: false,
    text
  };
}

// =============================
// 2. COMMON PHRASES
// =============================

function applyCommonPhrases(text) {
  let result = String(text || "");
  const phrases = Object.keys(commonPhrases).sort((a, b) => b.length - a.length);
  const placeholders = new Map();
  let index = 0;

  for (const phrase of phrases) {
    const replacement = commonPhrases[phrase];
    const regex = new RegExp(
      `(?<![\\p{L}0-9])${escapeRegExp(phrase)}(?![\\p{L}0-9])`,
      "giu"
    );
    result = result.replace(regex, () => {
      const placeholder = `CRDSCOMMON${numberToLetters(index)}`;
      placeholders.set(placeholder, replacement);
      index += 1;
      return placeholder;
    });
  }

  return { text: result, placeholders };
}

// =============================
// 3. GLOSSARY
// =============================

function protectTerms(text) {
  let result = String(text || "");
  const placeholders = new Map();
  let index = 0;

  for (const [term, replacement] of Object.entries(GLOSSARY_MAPS.protectedTerms)) {
    const placeholder = `__PROTECTED_${index}__`;
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");

    if (regex.test(result)) {
      result = result.replace(regex, placeholder);
      placeholders.set(placeholder, replacement);
      index += 1;
    }
  }

  return { text: result, placeholders };
}

function restoreProtectedTerms(text, placeholders) {
  let result = String(text || "");

  for (const [placeholder, value] of placeholders.entries()) {
    const regex = new RegExp(escapeRegExp(placeholder), "g");
    result = result.replace(regex, value);
  }

  return result;
}

function applyPreferredTranslations(text) {
  let result = String(text || "");

  const entries = Object.entries(GLOSSARY_MAPS.preferredTranslations)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [source, target] of entries) {
    const regex = new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi");
    result = result.replace(regex, target);
  }

  return result;
}

// =============================
// 4. NEGACIONES Y ESTRUCTURAS
// =============================

function applyNegationPatterns(text) {
  let result = String(text || "");

  for (const rule of NEGATION_PATTERNS) {
    result = result.replace(rule.pattern, rule.replace);
  }

  return result;
}

function applySubjectVerbPatterns(text) {
  let result = String(text || "");

  for (const rule of SUBJECT_VERB_PATTERNS) {
    result = result.replace(rule.pattern, rule.replace);
  }

  return result;
}

function expandContractions(text) {
  let result = String(text || "");

  for (const rule of CONTRACTION_PATTERNS) {
    result = result.replace(rule.pattern, rule.replace);
  }

  return result;
}

function normalizeSubject(subject) {
  return normalize(subject);
}

function normalizeVerbBase(verb) {
  const lower = normalize(verb);

  if (COMMON_VERBS[lower]) return lower;

  if (lower.endsWith("ing")) {
    const withoutIng = lower.slice(0, -3);
    if (COMMON_VERBS[withoutIng]) return withoutIng;

    const withE = `${withoutIng}e`;
    if (COMMON_VERBS[withE]) return withE;

    const withoutDouble = withoutIng.replace(/([a-z])\1$/, "$1");
    if (COMMON_VERBS[withoutDouble]) return withoutDouble;
  }

  if (lower.endsWith("ed")) {
    const withoutEd = lower.slice(0, -2);
    if (COMMON_VERBS[withoutEd]) return withoutEd;

    const withE = lower.slice(0, -1);
    if (COMMON_VERBS[withE]) return withE;
  }

  return lower;
}

function getVerbInfo(verb) {
  const key = normalizeVerbBase(verb);
  const info = COMMON_VERBS[key];
  if (info) return info;

  const infinitive = translateVerbBase(key);
  if (!infinitive || infinitive === key) return null;

  return {
    infinitive,
    gerund: VERB_ING_MAP[normalize(verb)] || infinitive,
    future: {},
    past: {}
  };
}

function translateObject(object) {
  const lower = normalize(object);
  return OBJECT_FORMS[lower] || translateByWordDictionary(object);
}

function translatePrepositionalObject(object) {
  const lower = normalize(object);
  return PREPOSITIONAL_OBJECT_FORMS[lower] || translateByWordDictionary(object);
}

function attachObjectToInfinitivePhrase(phrase, verbInfo, objectText = "") {
  const object = normalize(objectText);
  if (!object || !verbInfo?.infinitive) return phrase;

  if (verbInfo.objectPreposition) {
    return `${phrase} ${verbInfo.objectPreposition} ${translatePrepositionalObject(object)}`;
  }

  const suffix = translateObject(object);
  if (!suffix) return phrase;

  const infinitive = verbInfo.infinitive;
  if (phrase.endsWith(infinitive)) {
    return `${phrase.slice(0, -infinitive.length)}${infinitive}${suffix}`;
  }

  return `${phrase} ${suffix}`;
}

function translateVerbWithObject(verbText, objectText = "", options = {}) {
  const object = normalize(objectText);
  if (!object) return verbText;

  if (options.placement === "infinitive") {
    return attachObjectToInfinitivePhrase(verbText, options.verbInfo, object);
  }

  const translatedObject = translateObject(object);
  if (!translatedObject) return verbText;

  return `${translatedObject} ${verbText}`;
}

function preservePhrasePattern(text, placeholders, replacement) {
  const placeholder = `CRDSPATTERN${numberToLetters(placeholders.size)}`;
  placeholders.set(placeholder, replacement);
  return placeholder;
}

function applyPhrasePatterns(text) {
  let result = String(text || "");
  const placeholders = new Map();
  const subjectPattern = "(i|you|he|she|it|we|they)";
  const objectPattern = "(me|you|him|her|us|them|it)";
  const verbPattern = "([a-z]+)";
  const ingPattern = "([a-z]+ing)";
  const tail = "(?:[.!?,;:]|$)";

  const replaceWith = (pattern, callback) => {
    result = result.replace(pattern, (...args) => {
      const match = args[0];
      const offset = args.at(-2);
      const source = result;
      const previous = source[offset - 1] || "";
      const next = source[offset + match.length] || "";

      if (/[\p{L}0-9]/u.test(previous) || /[\p{L}0-9]/u.test(next)) {
        return match;
      }

      const replacement = callback(...args);
      if (!replacement) return match;

      return preservePhrasePattern(result, placeholders, replacement);
    });
  };

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:am|are|is)\\s+${ingPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const subjectInfo = SUBJECT_FORMS[subject];
      const verbInfo = getVerbInfo(verbRaw);
      if (!subjectInfo || !verbInfo) return null;

      const phrase = `${subjectInfo.estar} ${verbInfo.gerund}`;
      return translateVerbWithObject(phrase, objectRaw);
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:will|shall)\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const verbInfo = getVerbInfo(verbRaw);
      const verb = verbInfo?.future?.[subject];
      if (!verb) return null;

      return translateVerbWithObject(verb, objectRaw);
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:have|has)\\s+to\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const subjectInfo = SUBJECT_FORMS[subject];
      const verbInfo = getVerbInfo(verbRaw);
      if (!subjectInfo || !verbInfo) return null;

      const phrase = `${subjectInfo.tenerQue} ${verbInfo.infinitive}`;
      return translateVerbWithObject(phrase, objectRaw, {
        placement: "infinitive",
        verbInfo
      });
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:need|needs)\\s+to\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const subjectInfo = SUBJECT_FORMS[subject];
      const verbInfo = getVerbInfo(verbRaw);
      if (!subjectInfo || !verbInfo) return null;

      const phrase = `${subjectInfo.necesitar} ${verbInfo.infinitive}`;
      return translateVerbWithObject(phrase, objectRaw, {
        placement: "infinitive",
        verbInfo
      });
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:want|wants)\\s+to\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const subjectInfo = SUBJECT_FORMS[subject];
      const verbInfo = getVerbInfo(verbRaw);
      if (!subjectInfo || !verbInfo) return null;

      const phrase = `${subjectInfo.querer} ${verbInfo.infinitive}`;
      return translateVerbWithObject(phrase, objectRaw, {
        placement: "infinitive",
        verbInfo
      });
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:can)\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const subjectInfo = SUBJECT_FORMS[subject];
      const verbInfo = getVerbInfo(verbRaw);
      if (!subjectInfo || !verbInfo) return null;

      const phrase = `${subjectInfo.poder} ${verbInfo.infinitive}`;
      return translateVerbWithObject(phrase, objectRaw, {
        placement: "infinitive",
        verbInfo
      });
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+(?:cannot|can't)\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const subjectInfo = SUBJECT_FORMS[subject];
      const verbInfo = getVerbInfo(verbRaw);
      if (!subjectInfo || !verbInfo) return null;

      const phrase = `${subjectInfo.poderNo} ${verbInfo.infinitive}`;
      return translateVerbWithObject(phrase, objectRaw, {
        placement: "infinitive",
        verbInfo
      });
    }
  );

  replaceWith(
    new RegExp(`${subjectPattern}\\s+${verbPattern}(?:ed)?\\s+${objectPattern}${tail}`, "giu"),
    (_match, subjectRaw, verbRaw, objectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      const verbInfo = getVerbInfo(verbRaw);
      const verb = verbInfo?.past?.[subject];
      if (!verb) return null;

      return translateVerbWithObject(verb, objectRaw);
    }
  );

  replaceWith(
    new RegExp(`(?:do\\s+not|don't)\\s+${verbPattern}(?:\\s+${objectPattern})?${tail}`, "giu"),
    (_match, verbRaw, objectRaw) => {
      const verbInfo = getVerbInfo(verbRaw);
      if (!verbInfo) return null;

      if (normalize(verbRaw) === "move" && !objectRaw) {
        return "no te muevas";
      }

      const phrase = `no ${verbInfo.infinitive}`;
      return translateVerbWithObject(phrase, objectRaw, {
        placement: "infinitive",
        verbInfo
      });
    }
  );

  replaceWith(
    new RegExp(`are\\s+you\\s+(?:okay|alright|fine)${tail}`, "giu"),
    () => "¿estás bien?"
  );

  replaceWith(
    new RegExp(`where\\s+are\\s+${subjectPattern}${tail}`, "giu"),
    (_match, subjectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      if (subject === "you") return "¿dónde estás?";
      if (subject === "we") return "¿dónde estamos?";
      if (subject === "they") return "¿dónde están?";

      const subjectText = SUBJECT_FORMS[subject]?.pronoun;
      if (!subjectText) return null;
      return `¿dónde está ${subjectText}?`;
    }
  );

  replaceWith(
    new RegExp(`what\\s+are\\s+${subjectPattern}\\s+doing${tail}`, "giu"),
    (_match, subjectRaw) => {
      const subject = normalizeSubject(subjectRaw);
      if (subject === "you") return "¿qué estás haciendo?";
      const subjectText = SUBJECT_FORMS[subject]?.pronoun;
      if (!subjectText) return null;
      return `¿qué está haciendo ${subjectText}?`;
    }
  );

  return { text: result, placeholders };
}

// =============================
// 5. DICCIONARIO DE PALABRAS
// =============================

function singularizeEnglishWord(word) {
  const lower = normalize(word);

  if (IRREGULAR_PLURALS[lower]) {
    return { singular: lower, wasPlural: true };
  }

  if (lower.endsWith("ies") && lower.length > 3) {
    return { singular: `${lower.slice(0, -3)}y`, wasPlural: true };
  }

  if (lower.endsWith("es") && lower.length > 2) {
    return { singular: lower.slice(0, -2), wasPlural: true };
  }

  if (lower.endsWith("s") && lower.length > 1) {
    return { singular: lower.slice(0, -1), wasPlural: true };
  }

  return { singular: lower, wasPlural: false };
}

function pluralizeSpanishWord(word) {
  const value = String(word || "").trim();
  if (!value) return value;

  if (/[aeiouáéíóú]$/i.test(value)) {
    return `${value}s`;
  }

  return `${value}es`;
}

function translatePronoun(word) {
  return PRONOUN_TRANSLATIONS[normalize(word)] || null;
}

function translateAuxiliary(word) {
  return AUXILIARY_MAP[normalize(word)] || null;
}

function translateByGlossary(word) {
  const lower = normalize(word);

  for (const [source, target] of Object.entries(GLOSSARY_MAPS.preferredTranslations)) {
    if (normalize(source) === lower) {
      return target;
    }
  }

  return null;
}

function translateByWordDictionary(word) {
  const original = String(word || "");
  const lower = normalize(original);

  if (!lower) return original;

  if (IRREGULAR_PLURALS[lower]) {
    return IRREGULAR_PLURALS[lower];
  }

  let entry = wordDictionary[lower];
  let wasPlural = false;

  if (!entry) {
    const singularInfo = singularizeEnglishWord(lower);
    if (singularInfo.wasPlural) {
      const singularEntry = wordDictionary[singularInfo.singular];
      if (singularEntry) {
        entry = singularEntry;
        wasPlural = true;
      }
    }
  }

  if (!entry || !Array.isArray(entry.translations) || entry.translations.length === 0) {
    return original;
  }

  let translated = entry.translations[0];

  if (wasPlural && entry.pos === "noun") {
    translated = pluralizeSpanishWord(translated);
  }

  return translated;
}

function translateVerbBase(word) {
  const lower = normalize(word);
  return VERB_BASE_MAP[lower] || null;
}

function translateInflectedVerb(word) {
  const lower = normalize(word);
  return VERB_ING_MAP[lower] || VERB_PAST_MAP[lower] || null;
}

function translateWord(word) {
  if (!isWordToken(word)) return word;

  const pronoun = translatePronoun(word);
  if (pronoun) return pronoun;

  const auxiliary = translateAuxiliary(word);
  if (auxiliary) return auxiliary;

  const glossaryHit = translateByGlossary(word);
  if (glossaryHit) return glossaryHit;

  const verbHit = translateVerbBase(word);
  if (verbHit) return verbHit;

  const inflectedVerbHit = translateInflectedVerb(word);
  if (inflectedVerbHit) return inflectedVerbHit;

  const basicOverride = BASIC_WORD_OVERRIDES[normalize(word)];
  if (basicOverride) return basicOverride;

  const dictionaryHit = translateByWordDictionary(word);
  if (dictionaryHit !== word) return dictionaryHit;

  return word;
}

function applyWordDictionary(text) {
  const tokens = tokenize(text);
  const translated = tokens.map((token) => {
    if (!isWordToken(token)) return token;
    return translateWord(token);
  });

  return joinTokens(translated);
}

// =============================
// 6. REORDENADO BÁSICO
// =============================

function removeRedundantPronouns(text) {
  let result = String(text || "");

  result = result.replace(/\byo no puedo\b/gi, "no puedo");
  result = result.replace(/\byo no haré\b/gi, "no haré");
  result = result.replace(/\byo estoy\b/gi, "estoy");
  result = result.replace(/\byo tengo\b/gi, "tengo");
  result = result.replace(/\byo quiero\b/gi, "quiero");
  result = result.replace(/\byo necesito\b/gi, "necesito");
  result = result.replace(/\byo\b/gi, "");

  result = result.replace(/\btú no puedes\b/gi, "no puedes");
  result = result.replace(/\btú estás\b/gi, "estás");
  result = result.replace(/\btú tienes\b/gi, "tienes");
  result = result.replace(/\btú quieres\b/gi, "quieres");
  result = result.replace(/\btú\b/gi, "");

  result = result.replace(/\bnosotros\b/gi, "");
  result = result.replace(/\bellos\b/gi, "");

  return cleanSpaces(result);
}

function reorderBasicPatterns(text) {
  let result = String(text || "");

  // "no dejaré tú morir" -> "no dejaré que mueras"
  result = result.replace(/\bno dejaré tú morir\b/gi, "no dejaré que mueras");
  result = result.replace(/\bno dejaré lo morir\b/gi, "no dejaré que muera");
  result = result.replace(/\bno dejaré la morir\b/gi, "no dejaré que muera");

  // "yo no querer esto" -> "no quiero esto"
  result = result.replace(/\b(?:yo )?no querer\b/gi, "no quiero");
  result = result.replace(/\b(?:yo )?querer\b/gi, "quiero");

  // "yo necesitar ayuda" -> "necesito ayuda"
  result = result.replace(/\b(?:yo )?necesitar\b/gi, "necesito");

  // "yo poder" -> "puedo"
  result = result.replace(/\b(?:yo )?poder\b/gi, "puedo");
  result = result.replace(/\bno poder\b/gi, "no puedo");

  // "ellos estar viniendo" -> "ellos vienen"
  result = result.replace(/\bestán viniendo\b/gi, "vienen");
  result = result.replace(/\bestaba viniendo\b/gi, "venía");
  result = result.replace(/\bestar viniendo\b/gi, "venir");

  // "están llegando" mejor simple
  result = result.replace(/\bestán llegando\b/gi, "llegan");

  // "tener una oportunidad" mantenerlo bien
  result = result.replace(/\btener posibilidades\b/gi, "tener posibilidades");

  return cleanSpaces(result);
}

function removeArticlesWhereUseful(text) {
  const tokens = tokenize(text);
  const out = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const lower = normalize(token);
    const next = tokens[i + 1] || "";

    if (
      ARTICLES.has(lower) &&
      isWordToken(next)
    ) {
      continue;
    }

    if (PREPOSITIONS.has(lower)) {
      const mapped = {
        to: "a",
        of: "de",
        for: "para",
        with: "con",
        at: "en",
        from: "de",
        into: "en",
        on: "en",
        in: "en",
        by: "por",
        about: "sobre",
        after: "después de",
        before: "antes de"
      }[lower];

      out.push(mapped || token);
      continue;
    }

    out.push(token);
  }

  return joinTokens(out);
}

function finalPolish(originalText, translatedText) {
  let result = String(translatedText || "");

  result = cleanSpaces(result);
  result = removeRedundantPronouns(result);
  result = reorderBasicPatterns(result);
  result = cleanSpaces(result);

  // Capitalización
  if (/^[A-Z¿¡]/.test(String(originalText || "").trim())) {
    result = capitalizeFirst(result);
  }

  result = preserveFinalPunctuation(originalText, result);
  return result;
}

// =============================
// FUNCIÓN PRINCIPAL
// =============================

export function translate(text) {
  const originalText = String(text || "").trim();
  if (!originalText) return "";

  // 1. Translation Memory exacta
  const memoryResult = applyTranslationMemory(originalText);
  if (memoryResult.matched) {
    return finalPolish(originalText, memoryResult.text);
  }

  const workingText = expandContractions(originalText);

  // 2. Proteger términos
  const protectedData = protectTerms(workingText);
  let result = protectedData.text;

  const phraseData = applyPhrasePatterns(result);
  result = phraseData.text;

  // 3. Frases comunes
  const commonData = applyCommonPhrases(result);
  result = commonData.text;

  // 4. Glossary preferido
  result = applyPreferredTranslations(result);

  // 5. Negaciones y estructuras sujeto-verbo
  result = applyNegationPatterns(result);
  result = applySubjectVerbPatterns(result);

  // 6. Quitar algunos artículos/preposiciones inglesas antes del fallback
  result = removeArticlesWhereUseful(result);

  // 7. Traducción palabra a palabra
  result = applyWordDictionary(result);

  // 8. Restaurar términos protegidos
  result = restoreProtectedTerms(result, phraseData.placeholders);
  result = restoreProtectedTerms(result, commonData.placeholders);
  result = restoreProtectedTerms(result, protectedData.placeholders);

  // 9. Pulido final
  result = finalPolish(originalText, result);

  return result;
}
