/**
 * Indeling van ingrediënten volgens de Schijf van Vijf, plus een weekanalyse.
 *
 * Dit is bewust een aparte indeling dan `categorize.ts`: die volgt de looproute
 * van de supermarkt (waar fruit en groente in één schap liggen), terwijl de
 * Schijf van Vijf naar voedingswaarde kijkt (waar peulvruchten bij de eiwitten
 * horen en niet bij de groente).
 *
 * De adviezen komen van het Voedingscentrum. Dit is een grove indicatie op
 * basis van ingrediëntnamen, geen voedingsadvies.
 */

export type Vak =
  | 'groente'
  | 'fruit'
  | 'granen'      // brood, graanproducten en aardappelen
  | 'eiwit'       // vis, peulvruchten, vlees, ei en noten
  | 'zuivel'
  | 'vetten'      // smeer- en bereidingsvetten
  | 'dranken'
  | 'rest'        // valt buiten de Schijf van Vijf

/** Extra kenmerken die we per week willen kunnen tellen. */
export type Tag = 'vis' | 'roodvlees' | 'bewerktvlees' | 'peulvrucht' | 'noten' | 'volkoren' | 'vlees'

export type Classificatie = { vak: Vak; tags: Tag[] }

const PATRONEN: { re: RegExp; vak: Vak; tags?: Tag[] }[] = [
  // Vetten eerst: "olijfolie" mag niet als olijf (fruit) geteld worden.
  { re: /olijfolie|zonnebloemolie|koolzaadolie|arachideolie|sesamolie|bakolie|frituurvet|margarine|halvarine|\bolie\b|roomboter|\bboter\b(?!ham)/, vak: 'vetten' },

  // Peulvruchten en noten horen bij de eiwitten, niet bij groente of snacks.
  { re: /kikkererwt|\blinzen\b|kidneyboon|bruine boon|witte boon|zwarte boon|kapucijner|spliterwt|\btofu\b|tempeh|seitan|edamame|sojaboon/, vak: 'eiwit', tags: ['peulvrucht'] },
  // "-noot" wordt "-noten": de dubbele o valt weg, vandaar no[oe]?t.
  { re: /(wal|hazel|para|pecan|beuken)no[oe]?t|amandel|cashew|pistache|\bnoten\b|\bnootjes\b|pijnboompit|zonnebloempit|pompoenpit|\bpinda/, vak: 'eiwit', tags: ['noten'] },

  // Vis
  { re: /\bzalm|kabeljauw|tilapia|pangasius|koolvis|\bschol\b|\btonijn|garnaal|garnalen|mossel|oester|\bharing|makreel|forel|inktvis|ansjovis|sardine|\bvis\b|visfilet/, vak: 'eiwit', tags: ['vis'] },

  // Bewerkt vlees telt apart: daarvan adviseert het Voedingscentrum minder.
  { re: /\bworst|rookworst|salami|chorizo|\bspek|bacon|\bham\b|achterham|knakworst|frikandel|kroket|saucijs|boterhamworst|paté/, vak: 'eiwit', tags: ['vlees', 'bewerktvlees'] },
  // Rood vlees
  { re: /\brund|biefstuk|riblap|sucade|entrecote|varken|\bvark|speklap|\blams|\blam\b|kalfs|gehakt|hamburger|shoarma/, vak: 'eiwit', tags: ['vlees', 'roodvlees'] },
  // Wit vlees
  { re: /\bkip\b|kipfilet|kipdij|kippen|kalkoen|\beend\b|schnitzel/, vak: 'eiwit', tags: ['vlees'] },

  // Ei
  { re: /\bei\b|\beieren\b|eitjes|scharrelei/, vak: 'eiwit' },

  // Zuivel
  { re: /\bmelk\b|karnemelk|halfvolle|magere melk|yoghurt|kwark|skyr|kefir|\bvla\b|\bkaas\b|geraspte kaas|jonge kaas|belegen|mozzarella|parmezaan|pecorino|ricotta|\bfeta\b|halloumi|geitenkaas|roomkaas|\bbrie\b|camembert|cottage cheese|slagroom|kookroom|cr[eè]me fra[iî]che|zure room|\broom\b/, vak: 'zuivel' },

  // Granen, brood en aardappelen
  { re: /volkoren|meergranen|zilvervlies|volkorenbrood/, vak: 'granen', tags: ['volkoren'] },
  { re: /\bbrood|stokbrood|baguette|ciabatta|pita|tortilla|\bwrap|\bnaan\b|beschuit|cracker|boterham|\bpasta|spaghetti|penne|fusilli|macaroni|tagliatelle|lasagne|tortellini|gnocchi|\brijst|risotto|basmati|couscous|quinoa|bulgur|noodle|noedel|\bmie\b|havermout|\bmuesli|cornflakes|\bbloem\b|meel\b|aardappel|krieltjes|polenta/, vak: 'granen' },

  // Fruit
  { re: /appel\b|appels|\bpeer\b|\bperen\b|banaan|bananen|aardbei|framboos|bosbes|braam|mango|ananas|meloen|druif|druiven|\bkers|pruim|abrikoos|perzik|nectarine|\bvijg|citroen|limoen|sinaasappel|mandarijn|grapefruit|\bkiwi\b|granaatappel|\bdadel|rozijn|\bfruit|olijven|avocado/, vak: 'fruit' },

  // Groente
  { re: /tomaat|tomaten|paprika|\bui\b|\buien|sjalot|knoflook|wortel|winterpeen|\bsla\b|ijsbergsla|kropsla|veldsla|little gem|rucola|paksoi|andijvie|spinazie|boerenkool|broccoli|bloemkool|courgett|aubergine|pompoen|bleekselderij|selderij|witlof|radijs|\bbiet|\bprei\b|venkel|komkommer|champignon|paddenstoel|portobello|\bmais\b|doperwt|\berwten\b|sperzieboon|snijboon|tuinboon|boontjes|asperge|artisjok|\bkool\b|rodekool|spitskool|spruitjes|taugé|kiemgroente|groente|gezeefde tomat|tomatenblok|passata/, vak: 'groente' },

  // Dranken
  { re: /\bwater\b|bronwater|\bthee\b|\bkoffie|\bsap\b|smoothie|frisdrank|\bcola\b|limonade|\bbier\b|\bwijn\b/, vak: 'dranken' },
]

/** Deelt één ingrediëntnaam in bij een vak van de Schijf van Vijf. */
export function classify(name: string): Classificatie {
  const n = name.toLowerCase()
  for (const p of PATRONEN) {
    if (p.re.test(n)) return { vak: p.vak, tags: p.tags ?? [] }
  }
  return { vak: 'rest', tags: [] }
}

/** Eén gekookte of geplande maaltijd. */
export type Maaltijd = {
  date: string
  /** Titel van het recept, voor de opsomming in het overzicht. */
  title: string
  /**
   * `amount` en `unit` gebruikt de Schijf van Vijf zelf niet — die kijkt alleen
   * naar de naam. Ze reizen mee zodat `voeding.ts` er wél mee kan rekenen.
   */
  ingredients: { name: string; amount?: string; unit?: string }[]
  cuisine?: string | null
  /** Op hoeveel porties het recept is geschreven. */
  servings?: number
}

export type WeekAnalyse = {
  /** Aantal dagen in de periode waarvoor we een maaltijd kennen. */
  bekendeDagen: number
  totaalDagen: number
  /** Dagen met minstens één groente-ingrediënt. */
  groenteDagen: number
  fruitDagen: number
  visMaaltijden: number
  peulvruchtMaaltijden: number
  vleesloosDagen: number
  roodvleesMaaltijden: number
  bewerktvleesMaaltijden: number
  volkorenMaaltijden: number
  /** Aantal verschillende recepten, als maat voor variatie. */
  uniekeRecepten: number
  /** Recepten die meer dan één keer voorkwamen. */
  herhaald: { title: string; aantal: number }[]
  keukens: { naam: string; aantal: number }[]
  /** Verdeling van alle ingrediënten over de vakken. */
  vakken: Record<Vak, number>
}

/**
 * Rekent een lijst maaltijden door tot een weekbeeld.
 *
 * `totaalDagen` is het aantal dagen waar we naar kijken; maaltijden waarvan we
 * niets weten tellen niet mee als 'slecht', maar verlagen wel de dekking.
 */
export function analyseerWeek(maaltijden: Maaltijd[], totaalDagen = 7): WeekAnalyse {
  const vakken: Record<Vak, number> = {
    groente: 0, fruit: 0, granen: 0, eiwit: 0, zuivel: 0, vetten: 0, dranken: 0, rest: 0,
  }
  const dagenMetGroente = new Set<string>()
  const dagenMetFruit = new Set<string>()
  const dagenMetVlees = new Set<string>()
  const dagen = new Set<string>()
  const titelTelling = new Map<string, number>()
  const keukenTelling = new Map<string, number>()

  let visMaaltijden = 0
  let peulvruchtMaaltijden = 0
  let roodvleesMaaltijden = 0
  let bewerktvleesMaaltijden = 0
  let volkorenMaaltijden = 0

  for (const m of maaltijden) {
    dagen.add(m.date)
    titelTelling.set(m.title, (titelTelling.get(m.title) ?? 0) + 1)
    if (m.cuisine) keukenTelling.set(m.cuisine, (keukenTelling.get(m.cuisine) ?? 0) + 1)

    const tagsInMaaltijd = new Set<Tag>()
    for (const ing of m.ingredients) {
      const { vak, tags } = classify(ing.name)
      vakken[vak] += 1
      if (vak === 'groente') dagenMetGroente.add(m.date)
      if (vak === 'fruit') dagenMetFruit.add(m.date)
      for (const t of tags) tagsInMaaltijd.add(t)
    }
    if (tagsInMaaltijd.has('vis')) visMaaltijden += 1
    if (tagsInMaaltijd.has('peulvrucht')) peulvruchtMaaltijden += 1
    if (tagsInMaaltijd.has('roodvlees')) roodvleesMaaltijden += 1
    if (tagsInMaaltijd.has('bewerktvlees')) bewerktvleesMaaltijden += 1
    if (tagsInMaaltijd.has('volkoren')) volkorenMaaltijden += 1
    if (tagsInMaaltijd.has('vlees') || tagsInMaaltijd.has('vis')) dagenMetVlees.add(m.date)
  }

  return {
    bekendeDagen: dagen.size,
    totaalDagen,
    groenteDagen: dagenMetGroente.size,
    fruitDagen: dagenMetFruit.size,
    visMaaltijden,
    peulvruchtMaaltijden,
    vleesloosDagen: dagen.size - dagenMetVlees.size,
    roodvleesMaaltijden,
    bewerktvleesMaaltijden,
    volkorenMaaltijden,
    uniekeRecepten: titelTelling.size,
    herhaald: [...titelTelling.entries()]
      .filter(([, n]) => n > 1)
      .map(([title, aantal]) => ({ title, aantal }))
      .sort((a, b) => b.aantal - a.aantal),
    keukens: [...keukenTelling.entries()]
      .map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal),
    vakken,
  }
}

export type Bevinding = {
  status: 'goed' | 'let-op' | 'neutraal'
  titel: string
  uitleg: string
}

/**
 * Kijken we terug op wat er gegeten is, of vooruit op wat er gepland staat?
 *
 * De cijfers zijn identiek, maar de toon verschilt: terugkijkend is een
 * ontbrekend visgerecht een constatering, vooruitkijkend is het nog iets dat
 * je kunt veranderen.
 */
export type Richting = 'terug' | 'vooruit'

/**
 * Vertaalt de cijfers naar begrijpelijke bevindingen.
 *
 * Bewust mild geformuleerd: dit is een hulpmiddel om patronen te zien, geen
 * beoordeling. Bij weinig gegevens zeggen we dat, in plaats van te doen alsof
 * we het weten.
 */
export function bevindingen(a: WeekAnalyse, richting: Richting = 'terug'): Bevinding[] {
  const uit: Bevinding[] = []
  if (a.bekendeDagen === 0) return uit

  const vooruit = richting === 'vooruit'
  // "de bekende dagen" versus "de geplande dagen" — verder is de rekensom gelijk.
  const dagWoord = vooruit ? 'geplande' : 'bekende'

  const groenteAandeel = a.groenteDagen / a.bekendeDagen
  if (groenteAandeel >= 0.85) {
    uit.push({
      status: 'goed',
      titel: vooruit ? 'Elke dag groente gepland' : 'Elke dag groente',
      uitleg: vooruit
        ? `Op ${a.groenteDagen} van de ${a.bekendeDagen} geplande dagen staat er groente op het menu.`
        : `Op ${a.groenteDagen} van de ${a.bekendeDagen} bekende dagen stond er groente op tafel.`,
    })
  } else if (groenteAandeel >= 0.5) {
    uit.push({
      status: 'let-op',
      titel: 'Groente kan vaker',
      uitleg: `Groente op ${a.groenteDagen} van de ${a.bekendeDagen} ${dagWoord} dagen. Het advies is elke dag 250 gram.`,
    })
  } else {
    uit.push({
      status: 'let-op',
      titel: 'Weinig groente',
      uitleg: vooruit
        ? `Maar ${a.groenteDagen} van de ${a.bekendeDagen} geplande dagen met groente. Een extra groente bij een gerecht is zo bedacht.`
        : `Maar ${a.groenteDagen} van de ${a.bekendeDagen} dagen met groente. Een handvol extra bij het avondeten is zo gedaan.`,
    })
  }

  if (a.visMaaltijden >= 1) {
    uit.push({
      status: 'goed',
      titel: vooruit ? 'Vis staat gepland' : 'Vis gegeten',
      uitleg: `${a.visMaaltijden}× vis ${vooruit ? 'komende week' : 'deze week'}. Eén keer per week is het advies.`,
    })
  } else {
    uit.push({
      status: 'let-op',
      titel: vooruit ? 'Nog geen vis gepland' : 'Geen vis deze week',
      uitleg: vooruit
        ? 'Eén keer per week vis wordt aangeraden. Plan er nog een visgerecht bij, bij voorkeur vette vis zoals zalm of makreel.'
        : 'Eén keer per week vis wordt aangeraden, bij voorkeur vette vis zoals zalm of makreel.',
    })
  }

  if (a.peulvruchtMaaltijden >= 1) {
    uit.push({
      status: 'goed',
      titel: 'Peulvruchten op het menu',
      uitleg: `${a.peulvruchtMaaltijden}× peulvruchten, zoals linzen of kikkererwten.`,
    })
  } else {
    uit.push({
      status: 'let-op',
      titel: vooruit ? 'Nog geen peulvruchten gepland' : 'Geen peulvruchten',
      uitleg: 'Wekelijks peulvruchten is het advies — goedkoop, vezelrijk en makkelijk te verwerken.',
    })
  }

  if (a.vleesloosDagen >= 2) {
    uit.push({
      status: 'goed',
      titel: `${a.vleesloosDagen} dagen zonder vlees of vis`,
      uitleg: 'Mooie afwisseling tussen dierlijke en plantaardige eiwitten.',
    })
  }

  if (a.roodvleesMaaltijden + a.bewerktvleesMaaltijden > 3) {
    uit.push({
      status: 'let-op',
      titel: vooruit ? 'Vaak rood of bewerkt vlees gepland' : 'Vaak rood of bewerkt vlees',
      uitleg: `${a.roodvleesMaaltijden}× rood vlees en ${a.bewerktvleesMaaltijden}× bewerkt vlees. Het advies is maximaal 3 keer per week rood vlees.`,
    })
  }

  if (a.herhaald.length === 0 && a.bekendeDagen >= 3) {
    uit.push({
      status: 'goed',
      titel: 'Veel variatie',
      uitleg: `${a.uniekeRecepten} verschillende gerechten, geen enkele herhaling.`,
    })
  } else if (a.herhaald.length > 0) {
    const top = a.herhaald[0]
    uit.push({
      status: 'neutraal',
      titel: 'Herhaling in het menu',
      uitleg: `${top.title} staat ${top.aantal}× op het menu.`,
    })
  }

  return uit
}
