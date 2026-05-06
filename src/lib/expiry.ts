const SHELF_LIFE: Record<string, number> = {
  melk: 14, yoghurt: 14, kwark: 14, 'creme fraiche': 14, slagroom: 10,
  kaas: 21, mozzarella: 7, boter: 60,
  ei: 28, eieren: 28,
  brood: 5, baguette: 2,
  appel: 21, peer: 14, banaan: 7, citroen: 21, limoen: 14,
  tomaat: 7, paprika: 7, komkommer: 7, sla: 5, spinazie: 5,
  wortel: 21, ui: 60, knoflook: 90, aardappel: 30,
  kip: 2, gehakt: 2, vlees: 3, vis: 2, zalm: 2,
  pasta: 730, rijst: 730, bloem: 365, suiker: 730,
  olie: 365, azijn: 730, sojasaus: 365, honing: 730,
  blik: 730, kokosmelk: 730,
}

export function predictExpiry(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, days] of Object.entries(SHELF_LIFE)) {
    if (lower.includes(key)) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }
  }
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}
