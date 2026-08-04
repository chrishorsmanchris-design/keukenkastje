/**
 * Eén gedeelde productcategorisatie voor boodschappenlijst, pantry en recepten.
 *
 * Waarom één bestand: er stonden drie kopieën van deze functie in de app die
 * uit elkaar waren gelopen — met verschillende categorienamen, waardoor
 * producten op de ene plek keurig gesorteerd stonden en op de andere onder
 * "Overig" verdwenen.
 *
 * De volgorde van de regels is belangrijk. Samenstellingen worden eerst
 * afgevangen (EXCEPTIONS), anders wint een deelwoord: "pindakaas" zou anders
 * bij de kaas belanden en "boterham" bij het vlees.
 */

/** Fijnmazige interne categorie; wordt per scherm naar een weergavenaam gemapt. */
export type CategoryKey =
  | 'groente' | 'vlees' | 'zuivel' | 'brood' | 'graan' | 'blik'
  | 'saus' | 'drank' | 'snack' | 'diepvries' | 'verzorging' | 'huishouden' | 'overig'

/** Weergavenamen boodschappenlijst, in supermarkt-looproute. */
export const SHOPPING_CATEGORY_CONFIG: { name: string; icon: string }[] = [
  { name: 'Groente & fruit',         icon: '🥦' },
  { name: 'Brood & bakkerij',        icon: '🍞' },
  { name: 'Vlees & vis',             icon: '🥩' },
  { name: 'Zuivel & eieren',         icon: '🥛' },
  { name: 'Pasta & rijst',           icon: '🍝' },
  { name: 'Blikken & potten',        icon: '🥫' },
  { name: 'Sauzen & kruiden',        icon: '🫙' },
  { name: 'Snacks & zoet',           icon: '🍫' },
  { name: 'Dranken',                 icon: '🥤' },
  { name: 'Diepvries',               icon: '❄️' },
  { name: 'Persoonlijke verzorging', icon: '🧴' },
  { name: 'Huishouden',              icon: '🧽' },
  { name: 'Overig',                  icon: '📦' },
]

const SHOPPING_NAME: Record<CategoryKey, string> = {
  groente: 'Groente & fruit',
  brood: 'Brood & bakkerij',
  vlees: 'Vlees & vis',
  zuivel: 'Zuivel & eieren',
  graan: 'Pasta & rijst',
  blik: 'Blikken & potten',
  saus: 'Sauzen & kruiden',
  snack: 'Snacks & zoet',
  drank: 'Dranken',
  diepvries: 'Diepvries',
  verzorging: 'Persoonlijke verzorging',
  huishouden: 'Huishouden',
  overig: 'Overig',
}

/** Weergavenamen voorraadkast (andere indeling: op bewaarplek i.p.v. looproute). */
export const PANTRY_CATEGORY_CONFIG: { name: string; icon: string }[] = [
  { name: 'Zuivel & eieren',      icon: '🥛' },
  { name: 'Vlees & vis',          icon: '🥩' },
  { name: 'Groente & fruit',      icon: '🥦' },
  { name: 'Brood',                icon: '🍞' },
  { name: 'Droog & graan',        icon: '🍝' },
  { name: 'Blikken & potten',     icon: '🥫' },
  { name: 'Sauzen & oliën',       icon: '🫙' },
  { name: 'Kruiden & specerijen', icon: '🌿' },
  { name: 'Snacks & zoet',        icon: '🍫' },
  { name: 'Dranken',              icon: '🥤' },
  { name: 'Diepvries',            icon: '❄️' },
  { name: 'Overig',               icon: '📦' },
]

const PANTRY_NAME: Record<CategoryKey, string> = {
  zuivel: 'Zuivel & eieren',
  vlees: 'Vlees & vis',
  groente: 'Groente & fruit',
  brood: 'Brood',
  graan: 'Droog & graan',
  blik: 'Blikken & potten',
  saus: 'Sauzen & oliën',
  snack: 'Snacks & zoet',
  drank: 'Dranken',
  diepvries: 'Diepvries',
  verzorging: 'Overig',
  huishouden: 'Overig',
  overig: 'Overig',
}

/**
 * Kruiden en specerijen krijgen in de voorraadkast een eigen plank, maar liggen
 * in de supermarkt bij de sauzen. Daarom apart herkend.
 */
const KRUIDEN =
  /\bkruid|specerij|\bzout\b|zeezout|\bpeper\b|peperkorrel|komijn|kurkuma|kerrie|\bcurry|oregano|basilicum|tijm|rozemarijn|paprikapoeder|cayenne|chilipoeder|chilivlok|kaneel|nootmuskaat|kardemom|koriander|laurier|dille|peterselie|bieslook|\bmunt\b|salie|dragon|venkelzaad|karwij|anijs|kruidnagel|piment|saffraan|sumak|za'?atar|ras el hanout|garam masala|bouillon|\bvanille|\bgember|sesamzaad|maanzaad/

/**
 * Samenstellingen die anders bij een verkeerde categorie belanden.
 * Wordt vóór alle andere regels geëvalueerd, van boven naar beneden.
 */
const EXCEPTIONS: [RegExp, CategoryKey][] = [
  // Diepvries wint altijd: "spinazie diepvries" is geen versgroente.
  [/diepvries|bevroren|ingevroren|\bfrozen\b/, 'diepvries'],
  [/\bijs\b|ijsjes|roomijs|waterijs|ijstaart/, 'diepvries'],
  [/\bfriet\b|\bfrites\b|\bpatat\b|aardappelschijf|kroket|frikandel|bitterbal/, 'diepvries'],

  // -melk / -room die geen zuivel is
  [/kokosmelk|kokosroom|kokoscreme/, 'blik'],
  [/sojamelk|amandelmelk|havermelk|rijstmelk|plantaardige melk|sojayoghurt/, 'zuivel'],
  [/chocolademelk|chocomel/, 'drank'],

  // -kaas / -boter die geen zuivel is
  [/pindakaas|notenpasta|amandelpasta/, 'saus'],
  [/boterham(?!worst)/, 'brood'],
  [/boterhamworst/, 'vlees'],
  [/pindasaus|satesaus|sat[eé]saus/, 'saus'],

  // zoet broodbeleg
  [/hagelslag|vlokken|chocopasta|choco pasta|appelstroop|\bjam\b|marmelade|honing|stroop\b/, 'saus'],

  // -sap dat geen drinken is
  [/citroensap|limoensap|limoenensap/, 'groente'],

  // -meel / bloem
  [/bloemkool/, 'groente'],
  [/amandelmeel|kokosmeel|paneermeel|griesmeel|volkorenmeel/, 'graan'],
  [/\bbloemen\b|boeket|tulpen|rozen\b/, 'huishouden'],

  // groente die "rijst" of "chips" heet
  [/bloemkoolrijst|groenterijst/, 'groente'],
  [/tortillachips|nachochips|nacho'?s|mais chips|maischips/, 'snack'],

  // tomaat in pot/blik is geen versgroente
  [/tomatenblok|gezeefde tomat|tomatenpuree|passata|zongedroogde tomat|appelmoes/, 'blik'],

  // noten die geen borrelnoot zijn
  [/nootmuskaat|notenmuskaat/, 'saus'],
]

/** Categorieregels, in volgorde van specifiek naar algemeen. */
const RULES: [RegExp, CategoryKey][] = [
  // Huishouden en verzorging eerst: die woorden lijken op niets anders.
  [/shampoo|conditioner|douchegel|\bzeep\b|handzeep|tandpasta|tandenborstel|flosdraad|mondwater|deodorant|scheer|maandverband|tampon|luier|zonnebrand|pleister|wattenstaaf|\bwatten\b|haarlak|bodylotion|nagellak/, 'verzorging'],
  [/wasmiddel|wasverzachter|afwasmiddel|vaatwas|schoonmaak|allesreiniger|schuurmiddel|ontkalker|wc.?papier|toiletpapier|toiletblok|keukenrol|keukenpapier|papieren handdoek|vuilniszak|afvalzak|aluminiumfolie|vershoudfolie|bakpapier|\bspons|schuursponsje|theedoek|batterij|gloeilamp|\blamp\b|kaars|luchtverfrisser|kattenbakvulling|kattenvoer|hondenvoer|diervoer|plantenvoeding|potgrond/, 'huishouden'],

  // Sauzen, oliën en specerijen vóór groente/vlees (anders wint "vissaus" bij vis).
  [/\bolie\b|olijfolie|zonnebloemolie|kokosolie|sesamolie|arachideolie|truffelolie|azijn|balsamico|sojasaus|ketjap|teriyaki|vissaus|oestersaus|worcestershire|sriracha|sambal|tabasco|harissa|gochujang|\bmiso\b|currypasta|\bpesto|tahini|hummus|mosterd|ketchup|mayonaise|\bmayo\b|fritessaus|knoflooksaus|dressing|\bsaus\b|marinade|\bsuiker|siroop|bakpoeder|baking soda|maizena|gelatine/, 'saus'],
  [KRUIDEN, 'saus'],

  // Zuivel & eieren
  [/\bmelk\b|karnemelk|volle melk|halfvolle|magere melk|yoghurt|kwark|skyr|kefir|\bvla\b|pudding|slagroom|zure room|\broom\b|kookroom|cr[eè]me fra[iî]che|mascarpone|roomkaas|smeerkaas|geitenkaas|\bkaas\b|kaasplak|geraspte kaas|jonge kaas|belegen|mozzarella|parmezaan|pecorino|ricotta|\bfeta\b|halloumi|\bbrie\b|camembert|\bgouda\b|\bedam\b|boter\b|roomboter|kruidenboter|margarine|\bei\b|\beieren\b|eitjes|scharrelei/, 'zuivel'],

  // Vlees, vis en vleesvervangers
  [/\bkip\b|kipfilet|kipdij|kippen|kalkoen|\brund|biefstuk|gehakt|varken|\bvark|speklap|\bspek|bacon|\bham\b|achterham|beenham|\bworst|rookworst|saucijs|salami|chorizo|shoarma|sucade|schnitzel|hamburger|slavink|lams|\blam\b|kalfs|\beend\b|riblap|entrecote|\bbiefstuk/, 'vlees'],
  [/\bzalm|kabeljauw|tilapia|pangasius|koolvis|schol\b|\btonijn|garnaal|garnalen|mossel|oester|haring|makreel|forel|inktvis|\bvis\b|visfilet|vissticks|\bsushi|surimi|ansjovis|sardine/, 'vlees'],
  [/\btofu\b|tempeh|seitan|vegetarisch|vegaburger|vega burger|vleesvervanger|falafel|edamame/, 'vlees'],

  // Brood & bakkerij
  [/\bbrood|stokbrood|baguette|ciabatta|pistolet|bolletje|broodje|croissant|bagel|brioche|focaccia|\bwrap|tortilla|\bpita|\bnaan\b|beschuit|cracker|kn[aä]ckebr[oö]d|ontbijtkoek|\bcake\b|\btaart|gebak|muffin|donut|bladerdeeg|croutons|pannenkoek|poffertjes|\bpizza|pizzabodem/, 'brood'],

  // Pasta, rijst en droge waren
  [/\bpasta|spaghetti|penne|fusilli|macaroni|rigatoni|tagliatelle|lasagne|tortellini|ravioli|gnocchi|\brijst|risotto|basmati|jasmijnrijst|zilvervlies|couscous|quinoa|bulgur|noodle|noedel|\bmie\b|mihoen|\bbloem\b|havermout|\bmuesli|granola|cornflakes|ontbijtgranen|polenta|\bgist\b|\bzeewier|nori\b|\bcouscous/, 'graan'],

  // Blikken, potten en peulvruchten
  [/\bblik|\bpot\b|potje|kikkererwt|\blinzen|kidneybon|bruine bon|witte bon|zwarte bon|\bbonen in|olijven|augurk|kappertje|artisjokhart|ingeblikt|conserven|zilveruitjes|piccalilly/, 'blik'],

  // Groente & fruit
  [/tomaat|tomaten|paprika|\bui\b|\buien|sjalot|knoflook|wortel|winterpeen|\bsla\b|ijsbergsla|kropsla|veldsla|little gem|rucola|paksoi|andijvie|spinazie|boerenkool|broccoli|bloemkool|courgett|aubergine|avocado|pompoen|bleekselderij|selderij|witlof|radijs|\bbiet|\bprei\b|venkel|komkommer|champignon|paddenstoel|portobello|\bmais\b|doperwt|\berwten\b|sperzieboon|snijboon|tuinboon|boontjes|asperge|artisjok|\bkool\b|rodekool|witte kool|spitskool|spruitjes|aardappel|krieltjes|zoete aardappel|taugé|kiemgroente|groente/, 'groente'],
  [/appel\b|appels|\bpeer\b|\bperen\b|banaan|bananen|aardbei|framboos|bosbes|braam|mango|ananas|meloen|watermeloen|druif|druiven|\bkers|pruim|abrikoos|perzik|nectarine|\bvijg|citroen|limoen|sinaasappel|mandarijn|clementine|grapefruit|kiwi|granaatappel|dadel|\bfruit/, 'groente'],

  // Snacks & zoet
  [/chips\b|zoutjes|borrelnoot|popcorn|chocola|\bchoco\b|\breep\b|\bkoek|biscuit|stroopwafel|snoep|\bdrop\b|winegum|toffee|marshmallow|\bpinda|cashew|amandelen|walnoot|hazelnoot|pistache|paranoot|noten\b|\bnootjes|rozijn|gedroogde vruchten|mueslireep|\bsnack|pretzel/, 'snack'],

  // Dranken
  [/\bwater\b|bronwater|mineraalwater|\bspa\b|frisdrank|\bsap\b|sinaasappelsap|appelsap|smoothie|\bwijn\b|rode wijn|witte wijn|prosecco|champagne|\bbier\b|pils|\bcola\b|fanta|sprite|sinas|tonic|ranja|limonade|\bthee\b|ijsthee|\bkoffie|espresso|cappuccino|energydrink/, 'drank'],
]

/** Bepaalt de fijnmazige categorie van een productnaam. */
export function categorizeKey(name: string): CategoryKey {
  const n = name
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,;:!?]/g, ' ')
  for (const [re, cat] of EXCEPTIONS) if (re.test(n)) return cat
  for (const [re, cat] of RULES) if (re.test(n)) return cat
  return 'overig'
}

/** Categorienaam voor de boodschappenlijst. */
export function categorizeShopping(name: string): string {
  return SHOPPING_NAME[categorizeKey(name)]
}

/** Categorienaam voor de voorraadkast. */
export function categorizePantry(name: string): string {
  return PANTRY_NAME[categorizeKey(name)]
}

/**
 * Oude categorienamen uit de database die niet meer in een lijst voorkomen.
 * Zonder deze mapping zou zo'n item helemaal niet meer getoond worden.
 */
const LEGACY: Record<string, string> = {
  'Brood': 'Brood & bakkerij',
  'Droog & graan': 'Pasta & rijst',
  'Sauzen & oliën': 'Sauzen & kruiden',
  'Kruiden & specerijen': 'Sauzen & kruiden',
}

/**
 * Categorie voor weergave in de boodschappenlijst: gebruikt de opgeslagen
 * waarde, maar herclassificeert als die ontbreekt, 'Overig' is of van een
 * oudere indeling komt.
 */
export function shoppingCategoryFor(item: { name: string; category?: string | null }): string {
  const stored = item.category
  if (!stored || stored === 'Overig') return categorizeShopping(item.name)
  return LEGACY[stored] ?? stored
}
