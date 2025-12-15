-- Test data for debugging action items

-- First, let's see what's in the database
SELECT 'Users:' as info, count(*) FROM auth.users;
SELECT 'Profiles:' as info, count(*) FROM profiles;
SELECT 'Projects:' as info, count(*) FROM projects;
SELECT 'Action Items:' as info, count(*) FROM action_items;

-- Insert a test user if none exists
-- Note: This would normally be done through Supabase Auth, but for testing:
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert a test profile
INSERT INTO profiles (id, email, full_name, global_role, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test@example.com',
  'Test User',
  'user',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert a test project
INSERT INTO projects (id, name, description, created_at, updated_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'Test Project',
  'A test project for debugging',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add user to project
INSERT INTO project_members (project_id, user_id, project_role, created_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'member',
  NOW()
) ON CONFLICT (project_id, user_id) DO NOTHING;

-- Insert a test action item
INSERT INTO action_items (
  id, project_id, title, description, status, owner_user_id,
  owner_name, owner_email, created_at, updated_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440002',
  '660e8400-e29b-41d4-a716-446655440001',
  'Test Action Item',
  'This is a test action item for debugging',
  'Open',
  '550e8400-e29b-41d4-a716-446655440000',
  'Test User',
  'test@example.com',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Check what we inserted
SELECT 'Final Action Items:' as info, count(*) FROM action_items;
SELECT id, title, project_id, owner_user_id FROM action_items LIMIT 5;







