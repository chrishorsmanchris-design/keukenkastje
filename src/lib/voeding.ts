/**
 * Voedingswaarde per maaltijd.
 *
 * Dit is de laag ónder `schijf-van-vijf.ts`: die kijkt of een gerecht de goede
 * soorten voedsel bevat, deze rekent uit hoevéél. De weekanalyse is er de laag
 * boven.
 *
 * Twee dingen zijn hier bewust anders dan je zou verwachten:
 *
 * 1. We rekenen alleen met ingrediënten waarvan we het gewicht én de
 *    voedingswaarde kennen. "1 pak bloem" levert geen getal op, en dat zeggen
 *    we dan ook — liever een eerlijk "we konden 7 van de 11 ingrediënten
 *    meenemen" dan een precies ogend getal dat nergens op slaat.
 * 2. De waarden zijn afgeronde gemiddelden per 100 gram, in de geest van de
 *    NEVO-tabel van het RIVM. Merkverschillen, bereidingsverlies en hoe vol je
 *    een eetlepel schept zitten er niet in. Dit is een indicatie, geen etiket.
 */

/** Voedingswaarde, als absolute hoeveelheid of per 100 gram. */
export type Voedingswaarde = {
  kcal: number
  eiwit: number
  vet: number
  verzadigd: number
  koolhydraten: number
  suikers: number
  vezels: number
  zout: number
}

export const LEEG: Voedingswaarde = {
  kcal: 0, eiwit: 0, vet: 0, verzadigd: 0, koolhydraten: 0, suikers: 0, vezels: 0, zout: 0,
}

/** Korte notatie: [kcal, eiwit, vet, verzadigd, koolhydraten, suikers, vezels, zout] per 100 g. */
type Rij = [number, number, number, number, number, number, number, number]

function w(r: Rij): Voedingswaarde {
  return {
    kcal: r[0], eiwit: r[1], vet: r[2], verzadigd: r[3],
    koolhydraten: r[4], suikers: r[5], vezels: r[6], zout: r[7],
  }
}

/**
 * Per ingrediënt: het herkenningspatroon, de waarde per 100 g en — waar dat
 * betekenis heeft — het gewicht van één stuk in gram.
 *
 * De volgorde is die van `classify()` in schijf-van-vijf.ts: specifiek vóór
 * algemeen, anders vangt "olie" de olijfolie weg.
 */
const TABEL: { re: RegExp; per100: Voedingswaarde; stuk?: number }[] = [
  // ── Vetten en olie ─────────────────────────────────────────────────────────
  { re: /kokosolie|kokosvet/,                        per100: w([900, 0, 100, 87, 0, 0, 0, 0]) },
  { re: /olijfolie|zonnebloemolie|koolzaadolie|arachideolie|sesamolie|bakolie|\bolie\b/,
                                                      per100: w([900, 0, 100, 14, 0, 0, 0, 0]) },
  { re: /roomboter|\bboter\b(?!ham)/,                per100: w([720, 0.7, 80, 52, 0.6, 0.6, 0, 1.2]) },
  { re: /margarine|halvarine|bakvet|frituurvet/,     per100: w([600, 0, 67, 20, 0, 0, 0, 1]) },

  // ── Peulvruchten, noten en vleesvervangers ────────────────────────────────
  { re: /pindakaas/,                                  per100: w([600, 25, 50, 10, 12, 6, 6, 0.9]) },
  { re: /\bpinda/,                                    per100: w([580, 26, 49, 8, 8, 4, 8, 0]) },
  { re: /amandel/,                                    per100: w([600, 21, 50, 4, 7, 4, 12, 0]) },
  { re: /walnoot|walnoten|pecan|hazelnoot|hazelnoten|paranoot|paranoten/,
                                                      per100: w([650, 15, 65, 6, 7, 3, 6, 0]) },
  { re: /cashew|pistache/,                            per100: w([580, 18, 44, 8, 27, 6, 3, 0]) },
  { re: /pijnboompit/,                                per100: w([670, 14, 68, 5, 4, 3, 4, 0]) },
  { re: /zonnebloempit|pompoenpit|sesamzaad|lijnzaad|chiazaad/,
                                                      per100: w([580, 20, 48, 5, 10, 2, 9, 0]) },
  { re: /\bnoten\b|\bnootjes\b/,                      per100: w([620, 17, 55, 6, 12, 4, 7, 0.2]) },
  { re: /\blinzen\b/,                                 per100: w([115, 9, 0.4, 0.1, 16, 1, 8, 0.1]) },
  { re: /kikkererwt/,                                 per100: w([120, 7, 2.6, 0.3, 15, 0.8, 7, 0.4]) },
  { re: /kidneyboon|bruine boon|witte boon|zwarte boon|kapucijner|\bbonen\b/,
                                                      per100: w([110, 7, 0.5, 0.1, 15, 0.6, 7, 0.3]) },
  { re: /spliterwt|doperwt|\berwten\b/,               per100: w([80, 5, 0.4, 0.1, 11, 4, 5, 0]) },
  { re: /\btofu\b/,                                   per100: w([120, 13, 7, 1, 1, 0.5, 1, 0]) },
  { re: /tempeh/,                                     per100: w([190, 19, 11, 2, 6, 1, 5, 0]) },
  { re: /seitan/,                                     per100: w([140, 25, 2, 0.4, 5, 0.5, 1, 1]) },
  { re: /edamame|sojaboon/,                           per100: w([120, 11, 5, 0.7, 6, 2, 5, 0]) },
  { re: /vegetarisch gehakt|vega.?burger|vleesvervanger/,
                                                      per100: w([170, 17, 8, 1, 6, 1, 4, 1.2]) },

  // ── Vis ────────────────────────────────────────────────────────────────────
  { re: /\bzalm/,                                     per100: w([200, 20, 13, 2.5, 0, 0, 0, 0.1]) },
  { re: /makreel|\bharing|sardine|ansjovis/,          per100: w([220, 19, 16, 3.5, 0, 0, 0, 0.8]) },
  { re: /\btonijn/,                                   per100: w([110, 24, 1, 0.3, 0, 0, 0, 0.3]) },
  { re: /garnaal|garnalen|mossel|oester|inktvis/,     per100: w([85, 18, 1, 0.2, 0.5, 0, 0, 0.6]) },
  { re: /kabeljauw|tilapia|pangasius|koolvis|\bschol\b|forel|visfilet|\bvis\b/,
                                                      per100: w([85, 18, 1, 0.2, 0, 0, 0, 0.2]) },

  // ── Vlees ──────────────────────────────────────────────────────────────────
  { re: /\bspek|bacon|speklap/,                       per100: w([400, 14, 38, 14, 0, 0, 0, 2]) },
  { re: /salami|chorizo/,                             per100: w([430, 21, 38, 14, 1.5, 0.7, 0, 3.5]) },
  { re: /\bworst|rookworst|knakworst|saucijs|braadworst/,
                                                      per100: w([300, 13, 27, 10, 1.5, 0.5, 0, 2]) },
  { re: /\bham\b|achterham|boterhamworst|paté/,       per100: w([130, 19, 5, 2, 1, 0.5, 0, 2.5]) },
  { re: /frikandel|kroket|bitterbal/,                 per100: w([280, 9, 20, 8, 16, 1, 1, 1.8]) },
  { re: /gehakt|hamburger|\bbal(len)?\b/,             per100: w([250, 18, 20, 8, 1, 0.5, 0, 0.6]) },
  { re: /biefstuk|entrecote|riblap|sucade|\brund/,    per100: w([140, 21, 6, 2.5, 0, 0, 0, 0.1]) },
  { re: /varkenshaas|schnitzel|varken|\bvark/,        per100: w([130, 21, 5, 1.8, 0, 0, 0, 0.1]) },
  { re: /\blams|\blam\b|kalfs/,                       per100: w([170, 20, 10, 4.5, 0, 0, 0, 0.1]) },
  { re: /shoarma|gyros/,                              per100: w([210, 18, 15, 6, 1, 0.5, 0, 1.5]) },
  { re: /kipfilet|kipdij|kippen|\bkip\b|kalkoen/,     per100: w([110, 22, 2, 0.6, 0, 0, 0, 0.1]), stuk: 150 },
  { re: /\beend\b/,                                   per100: w([200, 19, 14, 5, 0, 0, 0, 0.2]) },
  { re: /\bei\b|\beieren\b|eitjes|scharrelei/,        per100: w([140, 12, 10, 3, 0.5, 0.4, 0, 0.3]), stuk: 55 },

  // ── Zuivel ─────────────────────────────────────────────────────────────────
  { re: /parmezaan|pecorino/,                         per100: w([400, 33, 29, 19, 0, 0, 0, 1.6]) },
  { re: /geraspte kaas|belegen|jonge kaas|goudse|\bkaas\b/,
                                                      per100: w([380, 25, 31, 20, 0, 0, 0, 2]) },
  { re: /mozzarella|halloumi/,                        per100: w([250, 18, 19, 12, 1, 1, 0, 1.5]) },
  { re: /\bfeta\b|geitenkaas/,                        per100: w([260, 14, 21, 15, 1, 1, 0, 3]) },
  { re: /\bbrie\b|camembert/,                         per100: w([330, 20, 27, 18, 0.5, 0.5, 0, 1.6]) },
  { re: /roomkaas|cottage cheese/,                    per100: w([230, 7, 22, 14, 3, 3, 0, 0.8]) },
  { re: /slagroom/,                                   per100: w([340, 2, 35, 22, 3, 3, 0, 0.1]) },
  { re: /cr[eè]me fra[iî]che|zure room/,              per100: w([300, 2.4, 30, 20, 3, 3, 0, 0.1]) },
  { re: /kookroom|\broom\b/,                          per100: w([200, 2.5, 20, 13, 3.5, 3.5, 0, 0.1]) },
  { re: /griekse yoghurt/,                            per100: w([115, 5, 9, 6, 3.5, 3.5, 0, 0.1]) },
  { re: /yoghurt|kefir/,                              per100: w([60, 4, 3, 2, 4.5, 4.5, 0, 0.1]) },
  { re: /kwark|skyr/,                                 per100: w([60, 10, 0.3, 0.2, 4, 4, 0, 0.1]) },
  { re: /\bvla\b/,                                    per100: w([95, 3.5, 3, 2, 14, 13, 0, 0.1]) },
  { re: /karnemelk/,                                  per100: w([37, 3.4, 0.5, 0.3, 4.5, 4.5, 0, 0.1]) },
  { re: /\bmelk\b|halfvolle|magere melk/,             per100: w([47, 3.5, 1.5, 1, 4.6, 4.6, 0, 0.1]) },

  // ── Granen, brood en aardappel ────────────────────────────────────────────
  { re: /havermout|\bmuesli|granola/,                 per100: w([375, 13, 7, 1.3, 58, 1, 10, 0]) },
  { re: /volkorenbrood|volkoren.?brood/,              per100: w([240, 10, 3, 0.7, 39, 3, 7, 1.1]), stuk: 35 },
  { re: /\bbrood|stokbrood|baguette|ciabatta|pita|boterham/,
                                                      per100: w([260, 9, 3, 0.7, 47, 3, 4, 1.2]), stuk: 35 },
  { re: /beschuit|cracker|toast/,                     per100: w([390, 11, 5, 1, 74, 4, 4, 1]), stuk: 10 },
  { re: /tortilla|\bwrap|\bnaan\b/,                   per100: w([300, 8, 7, 3, 50, 2, 3, 1.2]), stuk: 60 },
  { re: /zilvervlies|volkorenpasta|volkoren/,         per100: w([340, 13, 2.5, 0.5, 62, 3, 8, 0]) },
  { re: /\bpasta|spaghetti|penne|fusilli|macaroni|tagliatelle|lasagne|tortellini/,
                                                      per100: w([350, 12, 1.5, 0.3, 70, 3, 3, 0]) },
  { re: /noodle|noedel|\bmie\b/,                      per100: w([350, 11, 2, 0.5, 70, 2, 3, 0.4]) },
  { re: /gnocchi/,                                    per100: w([160, 4, 1, 0.3, 33, 1, 2, 0.8]) },
  { re: /\brijst|risotto|basmati|jasmijnrijst/,       per100: w([350, 7, 1, 0.2, 78, 0.2, 1.4, 0]) },
  { re: /couscous|bulgur/,                            per100: w([350, 12, 1, 0.2, 72, 0.5, 5, 0]) },
  { re: /quinoa/,                                     per100: w([370, 14, 6, 0.7, 58, 2, 7, 0]) },
  { re: /polenta/,                                    per100: w([360, 8, 1.5, 0.2, 76, 0.6, 4, 0]) },
  { re: /paneermeel/,                                 per100: w([370, 12, 3, 0.7, 70, 4, 4, 1.5]) },
  { re: /\bbloem\b|meel\b|maizena/,                   per100: w([350, 10, 1.2, 0.2, 71, 1.5, 3, 0]) },
  { re: /krieltjes|aardappel/,                        per100: w([85, 2, 0.1, 0, 17, 0.6, 2, 0]), stuk: 120 },
  { re: /zoete aardappel|bataat/,                     per100: w([90, 1.6, 0.1, 0, 20, 5, 3, 0]), stuk: 150 },
  { re: /friet|patat/,                                per100: w([190, 3, 7, 1, 28, 0.5, 3, 0.4]) },

  // ── Groente ────────────────────────────────────────────────────────────────
  { re: /knoflook/,                                   per100: w([130, 6, 0.5, 0.1, 25, 1, 2, 0]), stuk: 4 },
  { re: /broccoli/,                                   per100: w([34, 3, 0.4, 0.1, 4, 1.5, 3, 0]), stuk: 400 },
  { re: /bloemkool/,                                  per100: w([30, 2, 0.3, 0.1, 3, 2, 2, 0]), stuk: 600 },
  { re: /spruit/,                                     per100: w([40, 3.4, 0.3, 0.1, 5, 2, 4, 0]) },
  { re: /spinazie/,                                   per100: w([22, 2.8, 0.4, 0.1, 1, 0.4, 2, 0.1]) },
  { re: /boerenkool|paksoi|andijvie/,                 per100: w([30, 3, 0.5, 0.1, 2, 1, 3, 0.1]) },
  { re: /courgett/,                                   per100: w([20, 1.5, 0.3, 0.1, 2, 2, 1, 0]), stuk: 250 },
  { re: /aubergine/,                                  per100: w([25, 1, 0.2, 0, 3, 3, 3, 0]), stuk: 250 },
  { re: /paprika/,                                    per100: w([30, 1, 0.3, 0.1, 5, 4, 2, 0]), stuk: 150 },
  { re: /gezeefde tomat|tomatenblok|passata|tomatenpassata/,
                                                      per100: w([35, 1.5, 0.2, 0, 6, 5, 1.5, 0.1]) },
  { re: /tomatenpuree/,                               per100: w([80, 4, 0.5, 0.1, 12, 9, 3, 0.5]) },
  { re: /tomaat|tomaten|cherrytomaat/,                per100: w([20, 0.9, 0.2, 0, 3, 2.6, 1.2, 0]), stuk: 100 },
  { re: /sjalot/,                                     per100: w([40, 1.2, 0.1, 0, 8, 5, 1.5, 0]), stuk: 30 },
  { re: /\bui\b|\buien|rode ui/,                      per100: w([40, 1.2, 0.1, 0, 8, 5, 1.5, 0]), stuk: 110 },
  { re: /\bprei\b/,                                   per100: w([30, 1.5, 0.3, 0.1, 4, 2, 2, 0]), stuk: 150 },
  { re: /wortel|winterpeen|worteltjes/,               per100: w([35, 0.8, 0.2, 0, 7, 5, 2.5, 0.1]), stuk: 80 },
  { re: /champignon|paddenstoel|portobello|shiitake/, per100: w([22, 3, 0.3, 0.1, 1, 1, 1, 0]) },
  { re: /komkommer/,                                  per100: w([12, 0.6, 0.1, 0, 2, 1.5, 0.6, 0]), stuk: 300 },
  { re: /\bsla\b|ijsbergsla|kropsla|veldsla|little gem|rucola/,
                                                      per100: w([18, 1.5, 0.3, 0.1, 1.5, 1, 1.5, 0]) },
  { re: /bleekselderij|selderij|venkel|witlof|radijs/, per100: w([20, 1, 0.2, 0, 2, 1.5, 2, 0.1]) },
  { re: /pompoen/,                                    per100: w([30, 1, 0.2, 0, 5, 3, 2, 0]) },
  { re: /\bbiet|rodekool|spitskool|\bkool\b/,         per100: w([35, 1.5, 0.2, 0, 6, 5, 2.5, 0.1]) },
  { re: /sperzieboon|snijboon|tuinboon|boontjes|haricot/,
                                                      per100: w([32, 2, 0.2, 0, 4, 2, 3, 0]) },
  { re: /\bmais\b|ma[iï]s/,                           per100: w([90, 3, 1.2, 0.2, 17, 5, 3, 0.3]) },
  { re: /asperge|artisjok|taug[ée]|kiemgroente/,      per100: w([25, 2.5, 0.2, 0, 2, 1.5, 2, 0]) },
  { re: /gember/,                                     per100: w([80, 1.8, 0.8, 0.2, 15, 1.7, 2, 0]) },
  { re: /groente/,                                    per100: w([30, 1.8, 0.3, 0.1, 4, 2.5, 2, 0.1]) },

  // ── Fruit ──────────────────────────────────────────────────────────────────
  { re: /avocado/,                                    per100: w([190, 2, 18, 4, 2, 0.5, 6, 0]), stuk: 150 },
  { re: /olijven|olijf/,                              per100: w([150, 1, 15, 2, 1, 0, 3, 3]) },
  { re: /\bdadel|rozijn|gedroogde abrikoos/,          per100: w([290, 2.5, 0.5, 0.1, 66, 62, 6, 0]) },
  { re: /banaan|bananen/,                             per100: w([90, 1.1, 0.3, 0.1, 20, 17, 2, 0]), stuk: 120 },
  { re: /appel\b|appels/,                             per100: w([55, 0.3, 0.2, 0, 12, 11, 2, 0]), stuk: 150 },
  { re: /\bpeer\b|\bperen\b/,                         per100: w([58, 0.4, 0.2, 0, 13, 10, 3, 0]), stuk: 160 },
  { re: /citroen|limoen/,                             per100: w([25, 0.5, 0.2, 0, 3, 2, 1, 0]), stuk: 90 },
  { re: /sinaasappel|mandarijn|grapefruit/,           per100: w([45, 1, 0.2, 0, 9, 9, 2, 0]), stuk: 150 },
  { re: /aardbei|framboos|bosbes|braam|\bbes(sen)?\b/, per100: w([35, 0.8, 0.4, 0, 6, 5, 3, 0]) },
  { re: /mango|ananas|meloen|perzik|nectarine|abrikoos|pruim|\bkers/,
                                                      per100: w([55, 0.6, 0.2, 0, 12, 11, 2, 0]) },
  { re: /druif|druiven/,                              per100: w([70, 0.6, 0.2, 0, 16, 16, 1, 0]) },
  { re: /\bkiwi\b|granaatappel|\bvijg/,               per100: w([60, 1, 0.4, 0, 12, 10, 3, 0]) },
  { re: /\bfruit/,                                    per100: w([55, 0.7, 0.3, 0.1, 11, 10, 2, 0]) },

  // ── Sauzen, smaakmakers en zoet ───────────────────────────────────────────
  { re: /kokosmelk|kokosroom/,                        per100: w([200, 2, 20, 18, 3, 2, 0, 0.1]) },
  { re: /mayonaise|\bmayo\b|remouladesaus/,           per100: w([700, 1, 75, 6, 2, 2, 0, 1.2]) },
  { re: /\bpesto\b/,                                  per100: w([450, 5, 45, 7, 5, 3, 1, 2.5]) },
  { re: /ketchup|curry.?ketchup/,                     per100: w([110, 1, 0.2, 0, 25, 22, 1, 2]) },
  { re: /sojasaus|ketjap|vissaus/,                    per100: w([80, 6, 0.2, 0, 12, 8, 0, 15]) },
  { re: /mosterd/,                                    per100: w([130, 7, 8, 0.5, 6, 3, 3, 4]) },
  { re: /sambal|sriracha|harissa|chilisaus/,          per100: w([100, 2, 1, 0.2, 20, 15, 2, 6]) },
  { re: /bouillonblokje|bouillontablet/,              per100: w([200, 10, 12, 6, 12, 2, 0, 42]), stuk: 4 },
  { re: /bouillon|fond/,                              per100: w([5, 0.5, 0.2, 0.1, 0.5, 0.2, 0, 0.8]) },
  { re: /azijn|balsamico/,                            per100: w([20, 0.1, 0, 0, 4, 4, 0, 0]) },
  { re: /\bhoning|ahornsiroop|stroop/,                per100: w([320, 0.3, 0, 0, 80, 78, 0, 0]) },
  { re: /suiker|basterd/,                             per100: w([400, 0, 0, 0, 100, 100, 0, 0]) },
  { re: /chocolade|cacao|hagelslag/,                  per100: w([540, 6, 32, 19, 55, 50, 7, 0.1]) },
  { re: /\bzout\b|zeezout/,                           per100: w([0, 0, 0, 0, 0, 0, 0, 100]) },
  { re: /\bwijn\b/,                                   per100: w([80, 0.1, 0, 0, 2.6, 1, 0, 0]) },
  { re: /\bbier\b/,                                   per100: w([43, 0.5, 0, 0, 3.6, 0.3, 0, 0]) },
  { re: /\bwater\b|bronwater|\bthee\b|\bkoffie/,      per100: LEEG },
]

/**
 * Kruiden en specerijen: qua gewicht verwaarloosbaar, en we willen ze niet als
 * "onbekend" tellen — anders lijkt de dekking van elk recept slecht.
 */
const VERWAARLOOSBAAR =
  /peper|\bzout\b|paprikapoeder|komijn|kurkuma|kerrie|oregano|tijm|rozemarijn|basilicum|peterselie|koriander|bieslook|dille|laurier|kaneel|nootmuskaat|kruidnagel|kardemom|chilipoeder|chilivlokken|gedroogde|kruiden|specerij|bakpoeder|gist|vanille/

/** Zoekt de voedingswaarde per 100 g bij een ingrediëntnaam. */
export function voedingswaardeVan(name: string): { per100: Voedingswaarde; stuk?: number } | null {
  const n = name.toLowerCase()
  for (const rij of TABEL) {
    if (rij.re.test(n)) return { per100: rij.per100, stuk: rij.stuk }
  }
  if (VERWAARLOOSBAAR.test(n)) return { per100: LEEG }
  return null
}

// ── Hoeveelheden ─────────────────────────────────────────────────────────────

/** Maten die we in gram kunnen omrekenen zonder te weten wát het is. */
const MAAT_GRAM: { re: RegExp; gram: number }[] = [
  { re: /^kg$|kilo/,                    gram: 1000 },
  { re: /^g$|^gr$|gram/,                gram: 1 },
  { re: /^l$|liter/,                    gram: 1000 },
  { re: /^dl$|deciliter/,               gram: 100 },
  { re: /^ml$|mililiter|milliliter/,    gram: 1 },
  { re: /eetlepel|^el$|^tbsp$/,         gram: 15 },
  { re: /theelepel|^tl$|^tsp$/,         gram: 5 },
  { re: /snuf/,                         gram: 1 },
  { re: /handvol|hand vol/,             gram: 25 },
  { re: /teen|teentje/,                 gram: 4 },
  { re: /takje|blaadje/,                gram: 3 },
  { re: /plakje|^plak/,                 gram: 20 },
  { re: /bosje|bos\b/,                  gram: 30 },
  { re: /blik|blikje/,                  gram: 400 },
  { re: /\bpot\b|potje/,                gram: 350 },
  { re: /bakje/,                        gram: 250 },
  { re: /^kop$|kopje|^cup$/,            gram: 150 },
]

/**
 * Vertaalt "1½", "1,5", "2-3" en "2 à 3" naar een getal.
 * Geeft `null` bij "naar smaak", "wat" of een lege waarde.
 */
export function parseAantal(amount: string): number | null {
  if (!amount) return null
  const s = amount
    .toLowerCase()
    .replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75').replace(/⅓/g, '0.33')
    .replace(',', '.')
    .trim()

  // "1/2" of "1 1/2"
  const breuk = s.match(/^(\d+)?\s*(\d+)\s*\/\s*(\d+)/)
  if (breuk) {
    const heel = breuk[1] ? Number(breuk[1]) : 0
    return heel + Number(breuk[2]) / Number(breuk[3])
  }

  // "2-3" of "2 à 3": neem het gemiddelde, dat is eerlijker dan de onderkant.
  const reeks = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|tot|à|a)\s*(\d+(?:\.\d+)?)/)
  if (reeks) return (Number(reeks[1]) + Number(reeks[2])) / 2

  const enkel = s.match(/(\d+(?:\.\d+)?)/)
  return enkel ? Number(enkel[1]) : null
}

/**
 * Rekent één ingrediëntregel om naar gram.
 *
 * Geeft `null` als we het echt niet weten — "1 pak", "naar smaak", of een stuk
 * waarvan we het gewicht niet kennen. Dat is geen fout maar informatie.
 */
export function naarGram(
  amount: string,
  unit: string,
  stukGewicht?: number,
): number | null {
  const aantal = parseAantal(amount)
  const u = (unit ?? '').toLowerCase().trim()

  // Soms staat de eenheid in het hoeveelheidsveld: "200 gram".
  const gecombineerd = `${u} ${amount ?? ''}`.toLowerCase()

  for (const maat of MAAT_GRAM) {
    if (maat.re.test(u) || (!u && maat.re.test(gecombineerd))) {
      // "een snufje" heeft vaak geen getal; dan is één eenheid bedoeld.
      return (aantal ?? 1) * maat.gram
    }
  }

  if (aantal === null) return null

  // Geen bruikbare eenheid: dan is het een aantal stuks.
  const isStuk = !u || /^stuk|^st$|^stuks$|^x$/.test(u)
  if (isStuk && stukGewicht) return aantal * stukGewicht

  return null
}

// ── Per maaltijd ─────────────────────────────────────────────────────────────

export type IngredientRegel = { name: string; amount?: string; unit?: string }

export type MaaltijdVoeding = {
  /** Voedingswaarde van één portie. */
  perPortie: Voedingswaarde
  /** Voedingswaarde van het hele gerecht. */
  totaal: Voedingswaarde
  porties: number
  /** Ingrediënten die we konden meerekenen. */
  meegerekend: number
  /** Ingrediënten in het recept, inclusief de niet-meegerekende. */
  totaalIngredienten: number
  /** Wat we niet konden meerekenen, met de reden. */
  overgeslagen: { name: string; reden: 'onbekend product' | 'onbekende hoeveelheid' }[]
  /** Aandeel meegerekende ingrediënten: onder 0.6 is het echt een slag in de lucht. */
  dekking: number
}

function tel(a: Voedingswaarde, b: Voedingswaarde, factor: number): Voedingswaarde {
  return {
    kcal: a.kcal + b.kcal * factor,
    eiwit: a.eiwit + b.eiwit * factor,
    vet: a.vet + b.vet * factor,
    verzadigd: a.verzadigd + b.verzadigd * factor,
    koolhydraten: a.koolhydraten + b.koolhydraten * factor,
    suikers: a.suikers + b.suikers * factor,
    vezels: a.vezels + b.vezels * factor,
    zout: a.zout + b.zout * factor,
  }
}

function deel(a: Voedingswaarde, n: number): Voedingswaarde {
  if (n <= 0) return a
  return {
    kcal: a.kcal / n, eiwit: a.eiwit / n, vet: a.vet / n, verzadigd: a.verzadigd / n,
    koolhydraten: a.koolhydraten / n, suikers: a.suikers / n, vezels: a.vezels / n, zout: a.zout / n,
  }
}

/** Telt de voedingswaarde van een heel recept op en deelt door het aantal porties. */
export function voedingVoorRecept(
  ingredients: IngredientRegel[],
  porties = 2,
): MaaltijdVoeding {
  let totaal = { ...LEEG }
  let meegerekend = 0
  const overgeslagen: MaaltijdVoeding['overgeslagen'] = []
  // Kruiden tellen niet mee in de dekking: ze zeggen niets over de waarde.
  let telbaar = 0

  for (const ing of ingredients) {
    if (!ing?.name?.trim()) continue
    const match = voedingswaardeVan(ing.name)

    if (!match) {
      telbaar += 1
      overgeslagen.push({ name: ing.name, reden: 'onbekend product' })
      continue
    }
    // Verwaarloosbare kruiden: wel bekend, maar niet iets om over te rapporteren.
    if (match.per100 === LEEG && !match.stuk) continue

    const gram = naarGram(ing.amount ?? '', ing.unit ?? '', match.stuk)
    if (gram === null) {
      // "Zout naar smaak" staat in zowat elk recept. Dat als gemis rapporteren
      // maakt de dekking van élk recept onnodig laag, terwijl het om een snufje
      // gaat. Staat er wél een hoeveelheid bij, dan telt het gewoon mee — een
      // theelepel zout is 5 gram en dat scheelt echt.
      if (VERWAARLOOSBAAR.test(ing.name.toLowerCase())) continue
      telbaar += 1
      overgeslagen.push({ name: ing.name, reden: 'onbekende hoeveelheid' })
      continue
    }

    telbaar += 1

    totaal = tel(totaal, match.per100, gram / 100)
    meegerekend += 1
  }

  const p = porties > 0 ? porties : 1
  return {
    perPortie: deel(totaal, p),
    totaal,
    porties: p,
    meegerekend,
    totaalIngredienten: telbaar,
    overgeslagen,
    dekking: telbaar === 0 ? 0 : meegerekend / telbaar,
  }
}

// ── Oordeel ──────────────────────────────────────────────────────────────────

/**
 * Referentie-inname voor een gemiddelde volwassene, zoals op etiketten gebruikt
 * wordt. Individueel verschilt dit sterk — vandaar dat we percentages tonen en
 * geen goed- of afkeuring.
 */
export const RI_DAG: Voedingswaarde = {
  kcal: 2000, eiwit: 50, vet: 70, verzadigd: 20,
  koolhydraten: 260, suikers: 90, vezels: 30, zout: 6,
}

/** Welk deel van een dag een avondmaaltijd ongeveer beslaat. */
export const AANDEEL_AVONDMAALTIJD = 0.4

export type VoedingsSignaal = {
  status: 'goed' | 'let-op' | 'neutraal'
  titel: string
  uitleg: string
}

/**
 * Zet één portie om in begrijpelijke signalen.
 *
 * Alleen dingen waar iets over te zeggen valt: geen "je koolhydraten zijn 31%
 * van de referentie", want daar doet niemand iets mee.
 */
export function maaltijdSignalen(
  n: Voedingswaarde,
  aandeel = AANDEEL_AVONDMAALTIJD,
): VoedingsSignaal[] {
  const uit: VoedingsSignaal[] = []
  const grens = (key: keyof Voedingswaarde) => RI_DAG[key] * aandeel

  if (n.zout > grens('zout') * 1.25) {
    uit.push({
      status: 'let-op',
      titel: 'Vrij zout',
      uitleg: `${n.zout.toFixed(1)} g zout per portie. Voor een hele dag wordt maximaal 6 gram aangeraden.`,
    })
  }

  if (n.verzadigd > grens('verzadigd') * 1.25) {
    uit.push({
      status: 'let-op',
      titel: 'Veel verzadigd vet',
      uitleg: `${Math.round(n.verzadigd)} g verzadigd vet per portie, van de ${RI_DAG.verzadigd} g die voor een hele dag geldt.`,
    })
  }

  if (n.vezels >= grens('vezels')) {
    uit.push({
      status: 'goed',
      titel: 'Vezelrijk',
      uitleg: `${Math.round(n.vezels)} g vezels per portie — een flinke stap richting de 30 g per dag.`,
    })
  } else if (n.vezels > 0 && n.vezels < grens('vezels') * 0.4) {
    uit.push({
      status: 'let-op',
      titel: 'Weinig vezels',
      uitleg: `${Math.round(n.vezels)} g vezels. Volkoren, peulvruchten of extra groente helpen hier het meest.`,
    })
  }

  if (n.eiwit >= grens('eiwit')) {
    uit.push({
      status: 'goed',
      titel: 'Genoeg eiwit',
      uitleg: `${Math.round(n.eiwit)} g eiwit per portie.`,
    })
  }

  return uit
}

/** Percentage van de dagreferentie, afgerond. */
export function riPercentage(n: Voedingswaarde, key: keyof Voedingswaarde): number {
  return Math.round((n[key] / RI_DAG[key]) * 100)
}

/** Telt porties van meerdere maaltijden op tot een dagtotaal. */
export function telOp(waarden: Voedingswaarde[]): Voedingswaarde {
  return waarden.reduce((acc, v) => tel(acc, v, 1), { ...LEEG })
}
