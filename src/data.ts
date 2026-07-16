import type { AppData } from './types'

const isoDaysFromNow = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const isoMonthsAgo = (months: number) => {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return date.toISOString().slice(0, 10)
}

export const freezerGuide = [
  { category: 'Mleté maso', months: '3–4', max: 4, icon: '🥩' },
  { category: 'Steaky a pečeně', months: '4–12', max: 12, icon: '🥩' },
  { category: 'Drůbež – celá', months: '12', max: 12, icon: '🍗' },
  { category: 'Drůbež – porce', months: '9', max: 9, icon: '🍗' },
  { category: 'Ryby', months: '3–8', max: 8, icon: '🐟' },
  { category: 'Mořské plody', months: '3–12', max: 12, icon: '🦐' },
  { category: 'Hotová jídla', months: '3–4', max: 4, icon: '🍲' },
  { category: 'Polévky a dušená jídla', months: '2–3', max: 3, icon: '🥣' },
  { category: 'Vařené maso', months: '2–3', max: 3, icon: '🍖' },
  { category: 'Zelenina (blanšírovaná)', months: '8–12', max: 12, icon: '🥦' },
]

export const initialData: AppData = {
  products: [],
  pantry: [
    { id: 'p1', name: 'Červené fazole', category: 'Konzervy', location: 'Spíž', quantity: 1, minimum: 2, unit: 'ks', priceCzk: 34.9, purchasedAt: isoDaysFromNow(-14), expiresAt: isoDaysFromNow(240) },
    { id: 'p2', name: 'Těstoviny penne', category: 'Přílohy', location: 'Spíž', quantity: 3, minimum: 2, unit: 'bal.', priceCzk: 39.9, purchasedAt: isoDaysFromNow(-8), expiresAt: isoDaysFromNow(320) },
    { id: 'p3', name: 'Mléko plnotučné', category: 'Mléčné', location: 'Lednice', quantity: 1, minimum: 2, unit: 'l', priceCzk: 27.9, purchasedAt: isoDaysFromNow(-2), expiresAt: isoDaysFromNow(3) },
    { id: 'p4', name: 'Olivový olej', category: 'Vaření', location: 'Spíž', quantity: 1, minimum: 1, unit: 'ks', priceCzk: 219, purchasedAt: isoDaysFromNow(-35), expiresAt: isoDaysFromNow(180) },
    { id: 'p5', name: 'Dětské vlhčené ubrousky', category: 'Dětské', location: 'Drogerie', quantity: 4, minimum: 3, unit: 'bal.', priceCzk: 59.9, purchasedAt: isoDaysFromNow(-10) },
  ],
  freezer: [
    { id: 'f1', name: 'Kuřecí prsa', category: 'Drůbež – porce', quantity: 2, unit: 'bal.', frozenAt: isoMonthsAgo(2), recommendedMonths: 9, note: 'Po 500 g' },
    { id: 'f2', name: 'Losos', category: 'Ryby', quantity: 2, unit: 'ks', frozenAt: isoMonthsAgo(7), recommendedMonths: 8 },
    { id: 'f3', name: 'Zelenina na polévku', category: 'Zelenina (blanšírovaná)', quantity: 3, unit: 'bal.', frozenAt: isoMonthsAgo(4), recommendedMonths: 12 },
    { id: 'f4', name: 'Hovězí vývar', category: 'Polévky a dušená jídla', quantity: 1, unit: 'l', frozenAt: isoMonthsAgo(3), recommendedMonths: 3 },
  ],
  shoppingLists: [
    { id: 's1', name: 'Albert', type: 'Týdenní nákup', color: '#eb6b4d', items: [
      { id: 'si1', name: 'Červené fazole', quantity: 2, unit: 'ks', checked: false, addToPantry: true, kanbanMinimum: 2 },
      { id: 'si2', name: 'Mléko', quantity: 2, unit: 'l', checked: false, addToPantry: true, kanbanMinimum: 2 },
      { id: 'si3', name: 'Banány', quantity: 1, unit: 'kg', checked: true, priceCzk: 34.5, addToPantry: false },
    ]},
    { id: 's2', name: 'DM drogerie', type: 'Dětské potřeby', color: '#6d8f70', items: [
      { id: 'si4', name: 'Pleny vel. 5', quantity: 1, unit: 'bal.', checked: false, addToPantry: true, kanbanMinimum: 2 },
    ]},
  ],
  recipes: [
    { id: 'r1', name: 'Fazolové chilli', emoji: '🥘', minutes: 35, servings: 4, tags: ['Rychlé', 'Večeře'], ingredients: [{ name: 'Červené fazole', amount: '2 konzervy' }, { name: 'Rajčata', amount: '1 konzerva' }, { name: 'Mleté maso', amount: '500 g' }], instructions: 'Orestujte maso, přidejte rajčata a fazole. Okořeňte a 20 minut duste.', favorite: true },
    { id: 'r2', name: 'Krémová zeleninová polévka', emoji: '🥣', minutes: 30, servings: 4, tags: ['Vegetariánské', 'Mrazák'], ingredients: [{ name: 'Zelenina na polévku', amount: '1 balení' }, { name: 'Vývar', amount: '1 l' }, { name: 'Smetana', amount: '100 ml' }], instructions: 'Zeleninu uvařte ve vývaru, rozmixujte a zjemněte smetanou.', favorite: false },
    { id: 'r3', name: 'Losos s bylinkami', emoji: '🐟', minutes: 25, servings: 2, tags: ['Zdravé', 'Rychlé'], ingredients: [{ name: 'Losos', amount: '2 filety' }, { name: 'Brambory', amount: '500 g' }], instructions: 'Lososa osolte, přidejte bylinky a pečte 15 minut na 190 °C.', favorite: true },
  ],
  todos: [
    { id: 't1', title: 'Naplánovat týdenní nákup', date: isoDaysFromNow(0), done: false, category: 'Nákup' },
    { id: 't2', title: 'Odmrazit mrazák', date: isoDaysFromNow(4), done: false, category: 'Domácnost' },
    { id: 't3', title: 'Objednat dětskou výživu', date: isoDaysFromNow(1), done: true, category: 'Rodina' },
  ],
}
