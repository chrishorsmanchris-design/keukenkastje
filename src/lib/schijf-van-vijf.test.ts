import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, analyseerWeek, bevindingen } from './schijf-van-vijf'

test('deelt gewone ingrediënten in het juiste vak in', () => {
  assert.equal(classify('broccoli').vak, 'groente')
  assert.equal(classify('rode paprika').vak, 'groente')
  assert.equal(classify('appel').vak, 'fruit')
  assert.equal(classify('volkorenbrood').vak, 'granen')
  assert.equal(classify('spaghetti').vak, 'granen')
  assert.equal(classify('aardappelen').vak, 'granen')
  assert.equal(classify('kipfilet').vak, 'eiwit')
  assert.equal(classify('griekse yoghurt').vak, 'zuivel')
  assert.equal(classify('olijfolie').vak, 'vetten')
})

test('peulvruchten en noten tellen als eiwit, niet als groente of snack', () => {
  assert.equal(classify('kikkererwten').vak, 'eiwit')
  assert.ok(classify('kikkererwten').tags.includes('peulvrucht'))
  assert.equal(classify('walnoten').vak, 'eiwit')
  assert.ok(classify('walnoten').tags.includes('noten'))
})

test('onderscheidt vis, wit vlees, rood vlees en bewerkt vlees', () => {
  assert.ok(classify('zalmfilet').tags.includes('vis'))
  assert.ok(classify('kipfilet').tags.includes('vlees'))
  assert.ok(!classify('kipfilet').tags.includes('roodvlees'))
  assert.ok(classify('rundergehakt').tags.includes('roodvlees'))
  assert.ok(classify('chorizo').tags.includes('bewerktvlees'))
})

test('laat zich niet foppen door samenstellingen', () => {
  // Olijfolie is een vet, geen fruit.
  assert.equal(classify('olijfolie').vak, 'vetten')
  // Boterham is brood, geen vet.
  assert.equal(classify('boterham').vak, 'granen')
  // Gezeefde tomaten tellen gewoon als groente.
  assert.equal(classify('gezeefde tomaten').vak, 'groente')
})

test('telt dagen, niet ingrediënten, voor groente en vlees', () => {
  const a = analyseerWeek([
    { date: '2026-08-01', title: 'Pasta pesto', ingredients: [{ name: 'spaghetti' }, { name: 'courgette' }, { name: 'broccoli' }] },
    { date: '2026-08-02', title: 'Linzensoep', ingredients: [{ name: 'linzen' }, { name: 'wortel' }] },
    { date: '2026-08-03', title: 'Zalm', ingredients: [{ name: 'zalmfilet' }, { name: 'rijst' }] },
  ], 7)

  // Dag 1 heeft twee groentes maar telt als één dag.
  assert.equal(a.groenteDagen, 2)
  assert.equal(a.bekendeDagen, 3)
  assert.equal(a.visMaaltijden, 1)
  assert.equal(a.peulvruchtMaaltijden, 1)
  // Alleen de zalmdag bevat vis of vlees.
  assert.equal(a.vleesloosDagen, 2)
  assert.equal(a.uniekeRecepten, 3)
})

test('herkent herhaling in het menu', () => {
  const a = analyseerWeek([
    { date: '2026-08-01', title: 'Pasta pesto', ingredients: [{ name: 'spaghetti' }] },
    { date: '2026-08-03', title: 'Pasta pesto', ingredients: [{ name: 'spaghetti' }] },
  ], 7)
  assert.deepEqual(a.herhaald, [{ title: 'Pasta pesto', aantal: 2 }])
})

test('zegt niets zinnigs als er geen gegevens zijn', () => {
  const a = analyseerWeek([], 7)
  assert.equal(a.bekendeDagen, 0)
  assert.deepEqual(bevindingen(a), [])
})

test('meldt ontbrekende vis en peulvruchten als aandachtspunt', () => {
  const a = analyseerWeek([
    { date: '2026-08-01', title: 'Biefstuk', ingredients: [{ name: 'biefstuk' }, { name: 'aardappelen' }] },
  ], 7)
  const titels = bevindingen(a).map(b => b.titel)
  assert.ok(titels.includes('Geen vis deze week'))
  assert.ok(titels.includes('Geen peulvruchten'))
})

test('formuleert vooruitkijkend als iets dat nog te plannen is', () => {
  const a = analyseerWeek([
    { date: '2026-08-24', title: 'Biefstuk', ingredients: [{ name: 'biefstuk' }, { name: 'aardappelen' }] },
  ], 7)

  const terug = bevindingen(a, 'terug').map(b => b.titel)
  const vooruit = bevindingen(a, 'vooruit').map(b => b.titel)

  // Zelfde constatering, andere toon.
  assert.ok(terug.includes('Geen vis deze week'))
  assert.ok(vooruit.includes('Nog geen vis gepland'))
  assert.ok(vooruit.includes('Nog geen peulvruchten gepland'))

  // De cijfers zelf veranderen niet van richting.
  assert.equal(bevindingen(a, 'terug').length, bevindingen(a, 'vooruit').length)
})

test('vooruit noemt geplande groente ook echt gepland', () => {
  const a = analyseerWeek([
    { date: '2026-08-24', title: 'Roerbak', ingredients: [{ name: 'broccoli' }, { name: 'zalmfilet' }] },
    { date: '2026-08-25', title: 'Linzensoep', ingredients: [{ name: 'linzen' }, { name: 'wortel' }] },
  ], 7)
  const b = bevindingen(a, 'vooruit')
  assert.ok(b.some(x => x.titel === 'Elke dag groente gepland'))
  assert.ok(b.some(x => x.titel === 'Vis staat gepland'))
})
