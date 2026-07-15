export type Currency = 'CZK' | 'EUR'
export type Unit = 'ks' | 'kg' | 'g' | 'l' | 'ml' | 'bal.'
export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentColor = 'coral' | 'green' | 'blue' | 'plum'

export interface SiteSettings {
  householdName: string
  theme: ThemeMode
  accent: AccentColor
  defaultCurrency: Currency
  defaultLocation: PantryItem['location']
  defaultCategory: string
  defaultUnit: Unit
  defaultQuantity: number
  defaultMinimum: number
}

export interface PantryItem {
  id: string
  name: string
  category: string
  location: 'Spíž' | 'Lednice' | 'Koupelna' | 'Drogerie'
  quantity: number
  minimum: number
  unit: Unit
  priceCzk: number
  purchasedAt: string
  expiresAt?: string
  barcode?: string
  image?: string
}

export interface FreezerItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: Unit
  frozenAt: string
  recommendedMonths: number
  note?: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantity: number
  unit: Unit
  checked: boolean
  priceCzk?: number
  addToPantry: boolean
  kanbanMinimum?: number
}

export interface ShoppingList {
  id: string
  name: string
  type: string
  color: string
  items: ShoppingItem[]
  archived?: boolean
}

export interface Recipe {
  id: string
  name: string
  emoji: string
  minutes: number
  servings: number
  tags: string[]
  ingredients: { name: string; amount: string }[]
  instructions: string
  favorite: boolean
}

export interface Todo {
  id: string
  title: string
  date: string
  done: boolean
  category: 'Domácnost' | 'Nákup' | 'Rodina' | 'Jiné'
}

export interface AppData {
  pantry: PantryItem[]
  freezer: FreezerItem[]
  shoppingLists: ShoppingList[]
  recipes: Recipe[]
  todos: Todo[]
}
