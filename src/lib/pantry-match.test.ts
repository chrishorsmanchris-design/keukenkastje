import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findInPantry } from './pantry-match'

const pantry = [
  { name: 'tomaat' },
  { name: 'ui' },
  { name: 'olijfolie' },
  { name: 'kipfilet' },
  { name: 'melk' },
  { name: 'kaas' },
  { name: 'appel' },
  { name: 'aardappelen' },
  { name: 'bruine suiker' },
  { name: 'rode paprika' },
]

test('herkent meervoud en klinkerverkorting', () => {
  for (const ing of ['verse tomaten', 'tomaten (in blik)', 'tomaat', 'uien', 'kazen', 'appels']) {
    assert.ok(findInPantry(ing, pantry), `"${ing}" had gevonden moeten worden`)
  }
})

test('negeert hoeveelheden en bijvoeglijke naamwoorden', () => {
  for (const ing of ['rode ui', 'halve ui', 'geraspte kaas', '2 grote aardappelen']) {
    assert.ok(findInPantry(ing, pantry), `"${ing}" had gevonden moeten worden`)
  }
})

test('matcht niet op losse woorddelen', () => {
  // Anders zou "melk" matchen op "karnemelk" en zou je het nooit kopen.
  for (const ing of ['karnemelk', 'kipfilethaasje', 'knoflook', 'bloem', 'zout', 'peper', 'boter']) {
    assert.equal(findInPantry(ing, pantry), null, `"${ing}" had juist NIET gevonden moeten worden`)
  }
})

test('matcht een kern-ingredient op een specifiekere voorraad', () => {
  // "paprika" mag matchen op "rode paprika" die in huis ligt.
  assert.equal(findInPantry('paprika', pantry)?.name, 'rode paprika')
})

test('mag bewust iets te soepel zijn', () => {
  // "zoete aardappel" matcht op "aardappelen". Dat is strikt genomen fout,
  // maar de gebruiker krijgt deze matches altijd ter controle te zien
  // voordat er iets van de boodschappenlijst afgaat.
  assert.ok(findInPantry('zoete aardappel', pantry))
})
