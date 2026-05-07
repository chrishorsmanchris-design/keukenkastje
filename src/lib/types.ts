export type Ingredient = { name: string; amount: string; unit: string }
export type Step = { order: number; text: string; timer_minutes?: number }

export type Recipe = {
  id: string
  household_id: string
  user_id?: string
  title: string
  description?: string
  image_url?: string
  source_url?: string
  source_name?: string
  servings: number
  prep_time_minutes?: number
  cook_time_minutes?: number
  cuisine?: string
  ingredient_type?: string
  diet_labels: string[]
  ingredients: Ingredient[]
  steps: Step[]
  notes?: string
  created_at: string
}

export type PantryItem = {
  id: string
  household_id: string
  name: string
  quantity: number
  unit?: string
  expires_at?: string
  category?: string
  created_at: string
}

export type ShoppingItem = {
  id: string
  household_id: string
  name: string
  quantity?: number
  unit?: string
  category?: string
  checked: boolean
  recipe_id?: string
  is_manual: boolean
  created_at: string
}

export type WeekMenu = {
  id: string
  household_id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  recipe_id?: string
  servings: number
  recipe?: Recipe
}
