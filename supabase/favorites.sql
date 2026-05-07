ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
