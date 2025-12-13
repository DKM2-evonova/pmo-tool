-- Initialize updates field for existing action_items records
UPDATE action_items SET updates = '[]'::jsonb WHERE updates IS NULL;