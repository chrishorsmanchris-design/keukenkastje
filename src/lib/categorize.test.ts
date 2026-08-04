import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorizeShopping, categorizePantry, shoppingCategoryFor } from './categorize'

function check(cases: Record<string, string>) {
  const wrong: string[] = []
  for (const [name, expected] of Object.entries(cases)) {
    const actual = categorizeShopping(name)
    if (actual !== expected) wrong.push(`${name}: verwacht "${expected}", kreeg "${actual}"`)
  }
  assert.equal(wrong.length, 0, '\n' + wrong.join('\n'))
}

test('samenstellingen belanden niet in de verkeerde categorie', () => {
  // Dit zijn de fouten die de oude categorize() maakte.
  check({
    'boterham': 'Brood & bakkerij',
    'pindakaas': 'Sauzen & kruiden',
    'kokosmelk': 'Blikken & potten',
    'sojamelk': 'Zuivel & eieren',
    'amandelmelk': 'Zuivel & eieren',
    'chocolademelk': 'Dranken',
    'citroensap': 'Groente & fruit',
    'bloemkool': 'Groente & fruit',
    'bloemkoolrijst': 'Groente & fruit',
    'tortillachips': 'Snacks & zoet',
    'tomatenpuree': 'Blikken & potten',
    'gezeefde tomaten': 'Blikken & potten',
    'spinazie diepvries': 'Diepvries',
    'vissaus': 'Sauzen & kruiden',
    'amandelmeel': 'Pasta & rijst',
    'nootmuskaat': 'Sauzen & kruiden',
  })
})

test('een gewone weekboodschappenlijst valt niet in Overig', () => {
  const producten = [
    'rucola', 'paksoi', 'sjalot', 'bleekselderij', 'pompoen', 'radijs', 'witlof',
    'little gem', 'sinaasappel', 'mandarijn', 'kiwi', 'aardbeien', 'komkommer',
    'kipfilet', 'runderlappen', 'shoarma', 'spekjes', 'kabeljauw', 'mosselen',
    'gerookte zalm', 'tofu', 'tempeh', 'falafel', 'vegetarische burger',
    'vla', 'kwark', 'crème fraîche', 'geraspte kaas', 'scharreleieren', 'roomboter',
    'pistolet', 'beschuit', 'crackers', 'ontbijtkoek', 'bladerdeeg', 'wraps',
    'mihoen', 'bulgur', 'tortellini', 'gnocchi', 'muesli', 'cornflakes', 'granola',
    'bakpoeder', 'maizena', 'gist', 'zilvervliesrijst',
    'kikkererwten', 'bruine bonen', 'augurken', 'olijven', 'appelmoes',
    'sriracha', 'oestersaus', 'currypasta', 'hummus', 'bouillonblokjes',
    'laurierblad', 'kaneelpoeder', 'saffraan', 'ras el hanout', 'harissa',
    'chips', 'chocolade', 'koekjes', 'cashewnoten', 'walnoten', 'rozijnen', 'popcorn',
    'ijsthee', 'appelsap', 'espresso',
    'diepvriespizza', 'friet', 'roomijs',
    'wc-papier', 'afwasmiddel', 'vaatwastabletten', 'keukenrol', 'vuilniszakken',
    'aluminiumfolie', 'bakpapier', 'batterijen', 'kattenvoer',
    'deodorant', 'tandpasta', 'luiers',
  ]
  const overig = producten.filter(p => categorizeShopping(p) === 'Overig')
  assert.deepEqual(overig, [], `nog steeds Overig: ${overig.join(', ')}`)
})

test('recept-ingrediënten met hoeveelheden werken ook', () => {
  check({
    'Verse basilicum': 'Sauzen & kruiden',
    'rode ui': 'Groente & fruit',
    'olijfolie extra vierge': 'Sauzen & kruiden',
    'blik tomatenblokjes': 'Blikken & potten',
    'kipfilet, in blokjes': 'Vlees & vis',
    'Parmezaanse kaas': 'Zuivel & eieren',
  })
})

test('voorraadkast gebruikt zijn eigen indeling', () => {
  assert.equal(categorizePantry('spaghetti'), 'Droog & graan')
  assert.equal(categorizePantry('olijfolie'), 'Sauzen & oliën')
  assert.equal(categorizePantry('stokbrood'), 'Brood')
  assert.equal(categorizeShopping('spaghetti'), 'Pasta & rijst')
})

test('opgeslagen categorie wint, behalve bij Overig of oude namen', () => {
  assert.equal(shoppingCategoryFor({ name: 'kipfilet', category: 'Diepvries' }), 'Diepvries')
  // 'Overig' uit een oude versie wordt opnieuw bepaald
  assert.equal(shoppingCategoryFor({ name: 'rucola', category: 'Overig' }), 'Groente & fruit')
  // geen categorie (bijv. lijst gegenereerd vanuit het weekmenu)
  assert.equal(shoppingCategoryFor({ name: 'rucola', category: null }), 'Groente & fruit')
  // categorie uit de voorraadkast-indeling mag niet zoekraken
  assert.equal(shoppingCategoryFor({ name: 'penne', category: 'Droog & graan' }), 'Pasta & rijst')
})
