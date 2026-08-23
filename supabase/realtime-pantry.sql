-- Voorraadkast live meelezen tussen huisgenoten.
-- PantryClient luistert al op pantry_items, maar de tabel stond niet in de
-- realtime-publicatie, waardoor die meldingen nooit aankwamen.
alter publication supabase_realtime add table pantry_items;
