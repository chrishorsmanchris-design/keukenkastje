/**
 * Gedeelde logica om receptingrediënten te matchen met wat er in de pantry ligt.
 * Wordt gebruikt door de receptpagina ("heb ik dit in huis?"), het genereren van
 * de boodschappenlijst en "wat kan ik koken met wat ik heb?".
 */

export type PantryLike = { name: string; quantity?: number }

/** Woorden die niets zeggen over wélk product het is. */
const NOISE = [
  'verse', 'vers', 'gedroogde', 'gedroogd', 'gemalen', 'fijngehakte', 'fijngesneden',
  'gesneden', 'geraspte', 'geraspt', 'grof', 'fijn', 'kleine', 'grote', 'halve',
  'grote', 'biologische', 'bio', 'rode', 'groene', 'gele', 'witte', 'zwarte',
  'een', 'wat', 'snufje', 'scheutje', 'teentje', 'teentjes', 'blikje', 'blik',
  'naar', 'smaak', 'optioneel',
]

/** Maakt een ingrediëntnaam vergelijkbaar: kleine letters, geen ruis, enkelvoud-ish. */
export function normalizeName(raw: string): string {
  let s = raw.toLowerCase().trim()
  // Haakjes en alles erin weg: "tomaten (in blik)" → "tomaten"
  s = s.replace(/\([^)]*\)/g, ' ')
  // Leestekens weg
  s = s.replace(/[.,;:!?]/g, ' ')
  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !NOISE.includes(w))
  return words.join(' ').trim()
}

/** Klinkerverkorting en z/v-wisseling terugdraaien: kazen → kas, tomaten → tomat. */
function fold(word: string): string {
  let w = word
  if (w.endsWith('z')) w = w.slice(0, -1) + 's'
  else if (w.endsWith('v')) w = w.slice(0, -1) + 'f'
  w = w.replace(/([bdfglmnprst])\1$/, '$1') // bollen → boll → bol
  w = w.replace(/([aeou])\1/g, '$1') // tomaat → tomat
  return w
}

/**
 * Alle plausibele vormen van één woord. Nederlands kent te veel
 * meervoudsregels om één stam te kiezen ("kaas" eindigt op een s maar is
 * enkelvoud), dus verzamelen we varianten en kijken of twee woorden er één
 * delen.
 */
function variants(word: string): Set<string> {
  const out = new Set<string>([word, fold(word)])
  if (word.length >= 4 && word.endsWith('en')) {
    const base = word.slice(0, -2)
    out.add(base)
    out.add(fold(base))
  }
  if (word.length >= 4 && word.endsWith('s')) {
    const base = word.slice(0, -1)
    out.add(base)
    out.add(fold(base))
  }
  return out
}

function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  const va = variants(a)
  for (const v of variants(b)) if (va.has(v)) return true
  return false
}

function words(raw: string): string[] {
  return normalizeName(raw).split(' ').filter(Boolean)
}

/**
 * Vindt het pantry-item dat bij dit ingrediënt hoort, of null.
 * Bewust iets soepel: "verse tomaten" matcht op "tomaat".
 */
export function findInPantry<T extends PantryLike>(
  ingredientName: string,
  pantry: T[]
): T | null {
  const needle = words(ingredientName)
  if (!needle.length) return null

  // 1. Volledige match: elk woord komt overeen, in dezelfde volgorde.
  const exact = pantry.find((p) => {
    const hay = words(p.name)
    return hay.length === needle.length && hay.every((w, i) => wordsMatch(w, needle[i]))
  })
  if (exact) return exact

  // 2. De een bevat de ander als aaneengesloten woordgroep.
  //    "geraspte kaas" ↔ "kaas", maar niet "melk" ↔ "karnemelk".
  const found = pantry.find((p) => {
    const hay = words(p.name)
    if (!hay.length) return false
    return containsPhrase(hay, needle) || containsPhrase(needle, hay)
  })
  return found ?? null
}

/** Komt `needle` als aaneengesloten reeks voor in `haystack`? */
function containsPhrase(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((w, j) => wordsMatch(haystack[i + j], w))) return true
  }
  return false
}

export function isInPantry(ingredientName: string, pantry: PantryLike[]): boolean {
  return findInPantry(ingredientName, pantry) !== null
}
