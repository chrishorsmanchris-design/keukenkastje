-- 1. Voeg user_id toe aan recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. Backfill: koppel bestaande recepten aan de eigenaar van het huishouden
UPDATE recipes r
SET user_id = p.id
FROM profiles p
WHERE p.household_id = r.household_id
  AND p.is_owner = true
  AND r.user_id IS NULL;

-- 3. Fallback: recepten die nog steeds geen user_id hebben (geen owner) → eerste lid
UPDATE recipes r
SET user_id = p.id
FROM profiles p
WHERE p.household_id = r.household_id
  AND r.user_id IS NULL;

-- 4. Households tabel: zorg dat name kolom bestaat (waarschijnlijk al zo)
ALTER TABLE households ADD COLUMN IF NOT EXISTS name text;
