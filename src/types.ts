export type Currency = 'CZK' | 'EUR'
export type Unit = 'ks' | 'kg' | 'g' | 'l' | 'ml' | 'bal.'
export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentColor = 'coral' | 'green' | 'blue' | 'plum'

export interface SiteSettings {
  householdName: string
  language: import('./i18n').Language
  theme: ThemeMode
  accent: AccentColor
  customAccent: string
  defaultCurrency: Currency
  categories: string[]
  locations: string[]
  defaultLocation: string
  defaultCategory: string
  defaultUnit: Unit
  defaultQuantity: number
  defaultMinimum: number
}

export interface PantryItem {
  id: string
  name: string
  category: string
  location: string
  quantity: number
  minimum: number
  unit: Unit
  priceCzk: number
  purchasedAt: string
  expiresAt?: string
  barcode?: string
  image?: string
  nutritionPer100g?: {
    kcal: number
    carbs: number
    sugars: number
    fat: number
    protein: number
    fiber: number
  }
  portionGrams?: number
  productId?: string
}

export interface NutritionPer100g {
  kcal: number
  carbs: number
  sugars: number
  fat: number
  protein: number
  fiber: number
}

export interface FoodProduct {
  id: string
  name: string
  ean: string
  image: string
  nutritionPer100g: NutritionPer100g
  packageGrams: number
  category?: string
  brand?: string
  stores?: string
  eshopUrl?: string
  priceCzk?: number
  notes?: string
  source?: 'local' | 'open-food-facts'
  createdAt: string
  updatedAt: string
}

export type Gender = 'female' | 'male' | 'other'
export type MealType = 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner'

export interface DailyNutritionTargets extends NutritionPer100g {}

export interface WeightEntry {
  id: string
  date: string
  weightKg: number
}

export interface WeightProfile {
  id: string
  name: string
  gender: Gender
  age: number
  heightCm: number
  currentWeightKg: number
  targetWeightKg: number
  dailyTargets: DailyNutritionTargets
  weightEntries: WeightEntry[]
  createdAt: string
}

export interface MealEntry {
  id: string
  profileId: string
  date: string
  meal: MealType
  name: string
  grams: number
  nutritionPer100g: NutritionPer100g
  productId?: string
  recipeId?: string
  portionCount?: number
  image?: string
  source: 'catalog' | 'manual' | 'recipe'
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
  productId?: string
  barcode?: string
  image?: string
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
  productId?: string
  barcode?: string
  image?: string
}

export interface ShoppingList {
  id: string
  name: string
  type: string
  color: string
  items: ShoppingItem[]
  archived?: boolean
}

export interface RecipeIngredient {
  name: string
  amount: string
  grams?: number
  productId?: string
  nutritionPer100g?: NutritionPer100g
}

export interface Recipe {
  id: string
  name: string
  emoji: string
  minutes: number
  servings: number
  tags: string[]
  ingredients: RecipeIngredient[]
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
  foodCatalogSeedVersion?: number
  products: FoodProduct[]
  weightProfiles: WeightProfile[]
  mealEntries: MealEntry[]
  pantry: PantryItem[]
  freezer: FreezerItem[]
  shoppingLists: ShoppingList[]
  recipes: Recipe[]
  todos: Todo[]
}
