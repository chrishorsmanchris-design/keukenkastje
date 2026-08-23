import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAantal, naarGram, voedingswaardeVan, voedingVoorRecept, maaltijdSignalen, riPercentage,
} from './voeding'

test('leest hoeveelheden zoals mensen ze opschrijven', () => {
  assert.equal(parseAantal('2'), 2)
  assert.equal(parseAantal('1,5'), 1.5)
  assert.equal(parseAantal('½'), 0.5)
  assert.equal(parseAantal('1/2'), 0.5)
  assert.equal(parseAantal('2-3'), 2.5)
  assert.equal(parseAantal('2 à 3'), 2.5)
  assert.equal(parseAantal('naar smaak'), null)
  assert.equal(parseAantal(''), null)
})

test('rekent maten om naar gram', () => {
  assert.equal(naarGram('200', 'gram'), 200)
  assert.equal(naarGram('1', 'kg'), 1000)
  assert.equal(naarGram('250', 'ml'), 250)
  assert.equal(naarGram('2', 'eetlepel'), 30)
  assert.equal(naarGram('1', 'theelepel'), 5)
  assert.equal(naarGram('1', 'blik'), 400)
  // Zonder getal bedoelt "een snufje" gewoon één snufje.
  assert.equal(naarGram('', 'snufje'), 1)
})

test('gebruikt stukgewichten alleen als we ze kennen', () => {
  // 2 uien is ongeveer 220 gram.
  assert.equal(naarGram('2', 'stuks', 110), 220)
  // Een ui zonder bekend stukgewicht levert géén verzonnen getal op.
  assert.equal(naarGram('2', 'stuks'), null)
  // "1 pak" weten we echt niet.
  assert.equal(naarGram('1', 'pak', 110), null)
})

test('kent de voedingswaarde van gewone ingrediënten', () => {
  assert.equal(voedingswaardeVan('kipfilet')?.per100.eiwit, 22)
  assert.equal(voedingswaardeVan('olijfolie')?.per100.vet, 100)
  // Boterham is brood, geen boter.
  assert.ok((voedingswaardeVan('boterham')?.per100.koolhydraten ?? 0) > 40)
  // Kokosmelk is geen melk: veel meer verzadigd vet.
  assert.ok((voedingswaardeVan('kokosmelk')?.per100.verzadigd ?? 0) > 10)
  assert.equal(voedingswaardeVan('ruimtevaardersvoer'), null)
})

test('rekent een heel recept door naar één portie', () => {
  const v = voedingVoorRecept([
    { name: 'spaghetti', amount: '200', unit: 'gram' },
    { name: 'olijfolie', amount: '1', unit: 'eetlepel' },
    { name: 'kipfilet', amount: '300', unit: 'gram' },
  ], 2)

  // 200 g pasta = 700 kcal, 15 ml olie = 135 kcal, 300 g kip = 330 kcal.
  assert.equal(Math.round(v.totaal.kcal), 1165)
  assert.equal(Math.round(v.perPortie.kcal), 583)
  assert.equal(v.meegerekend, 3)
  assert.equal(v.dekking, 1)
})

test('is eerlijk over wat het niet weet', () => {
  const v = voedingVoorRecept([
    { name: 'spaghetti', amount: '200', unit: 'gram' },
    { name: 'sjoemelkruid', amount: '100', unit: 'gram' },
    { name: 'bloem', amount: '1', unit: 'pak' },
  ], 2)

  assert.equal(v.meegerekend, 1)
  assert.equal(v.totaalIngredienten, 3)
  assert.deepEqual(v.overgeslagen, [
    { name: 'sjoemelkruid', reden: 'onbekend product' },
    { name: 'bloem', reden: 'onbekende hoeveelheid' },
  ])
  assert.ok(v.dekking < 0.5)
})

test('laat kruiden de dekking niet verpesten', () => {
  const v = voedingVoorRecept([
    { name: 'kipfilet', amount: '300', unit: 'gram' },
    { name: 'peper', amount: 'naar smaak', unit: '' },
    { name: 'gedroogde oregano', amount: '1', unit: 'theelepel' },
  ], 2)

  // Alleen de kip telt mee, en de dekking is toch 100%.
  assert.equal(v.meegerekend, 1)
  assert.equal(v.totaalIngredienten, 1)
  assert.equal(v.dekking, 1)
})

test('"zout naar smaak" is geen gemis, een theelepel zout wel', () => {
  const smaak = voedingVoorRecept([
    { name: 'kipfilet', amount: '300', unit: 'gram' },
    { name: 'zout', amount: 'naar smaak', unit: '' },
  ], 2)
  assert.equal(smaak.dekking, 1)
  assert.deepEqual(smaak.overgeslagen, [])

  const lepel = voedingVoorRecept([
    { name: 'kipfilet', amount: '300', unit: 'gram' },
    { name: 'zout', amount: '1', unit: 'theelepel' },
  ], 2)
  // 5 gram zout over 2 porties: 2,5 gram per portie, bijna een halve dagnorm.
  assert.equal(Math.round(lepel.perPortie.zout * 10) / 10, 2.7)
})

test('meldt zout en verzadigd vet pas als het echt oploopt', () => {
  const zout = maaltijdSignalen({
    kcal: 700, eiwit: 25, vet: 20, verzadigd: 5,
    koolhydraten: 70, suikers: 10, vezels: 8, zout: 4,
  })
  assert.ok(zout.some(s => s.titel === 'Vrij zout'))

  const normaal = maaltijdSignalen({
    kcal: 700, eiwit: 25, vet: 20, verzadigd: 5,
    koolhydraten: 70, suikers: 10, vezels: 8, zout: 1.5,
  })
  assert.ok(!normaal.some(s => s.titel === 'Vrij zout'))
})

test('rekent percentages van de dagreferentie uit', () => {
  const halveDag = {
    kcal: 1000, eiwit: 25, vet: 35, verzadigd: 10,
    koolhydraten: 130, suikers: 45, vezels: 15, zout: 3,
  }
  assert.equal(riPercentage(halveDag, 'kcal'), 50)
  assert.equal(riPercentage(halveDag, 'zout'), 50)
})
