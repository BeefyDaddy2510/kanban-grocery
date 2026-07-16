import type { AppData, NutritionPer100g, Recipe, RecipeIngredient } from './types'

export const emptyNutrition = (): NutritionPer100g => ({ kcal: 0, carbs: 0, sugars: 0, fat: 0, protein: 0, fiber: 0 })
export const nutritionKeys: (keyof NutritionPer100g)[] = ['kcal', 'carbs', 'sugars', 'fat', 'protein', 'fiber']

export function parseIngredientGrams(amount: string) {
  const match = amount.trim().match(/([\d.,]+)\s*(kg|g|ml|l)\b/i)
  if (!match) return 0
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return 0
  return value * (['kg', 'l'].includes(match[2].toLowerCase()) ? 1000 : 1)
}

export function resolveIngredientNutrition(ingredient: RecipeIngredient, data: Pick<AppData, 'products' | 'pantry'>) {
  if (ingredient.nutritionPer100g) return ingredient.nutritionPer100g
  const byId = ingredient.productId ? data.products.find(product => product.id === ingredient.productId) : undefined
  if (byId) return byId.nutritionPer100g
  const name = ingredient.name.trim().toLocaleLowerCase('cs-CZ')
  return data.products.find(product => product.name.trim().toLocaleLowerCase('cs-CZ') === name)?.nutritionPer100g
    ?? data.pantry.find(item => item.name.trim().toLocaleLowerCase('cs-CZ') === name)?.nutritionPer100g
}

export function calculateRecipeNutrition(recipe: Recipe, data: Pick<AppData, 'products' | 'pantry'>) {
  const totalNutrition = emptyNutrition()
  let totalGrams = 0
  const missing: string[] = []

  for (const ingredient of recipe.ingredients) {
    const grams = Number(ingredient.grams) || parseIngredientGrams(ingredient.amount)
    const nutrition = resolveIngredientNutrition(ingredient, data)
    if (grams <= 0 || !nutrition) {
      missing.push(ingredient.name)
      continue
    }
    totalGrams += grams
    nutritionKeys.forEach(key => { totalNutrition[key] += (Number(nutrition[key]) || 0) * grams / 100 })
  }

  const ready = recipe.ingredients.length > 0 && missing.length === 0 && totalGrams > 0
  const nutritionPer100g = emptyNutrition()
  if (totalGrams > 0) nutritionKeys.forEach(key => { nutritionPer100g[key] = totalNutrition[key] * 100 / totalGrams })
  return { ready, totalGrams, totalNutrition, nutritionPer100g, missing }
}
