-- Migration: Create user_oauth_tokens table for Google Calendar integration
-- This table stores OAuth tokens for external service integrations

CREATE TABLE IF NOT EXISTS user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'google_calendar'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[], -- e.g., ['https://www.googleapis.com/auth/calendar.events.readonly']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Create index for faster lookups by user
CREATE INDEX idx_user_oauth_tokens_user_id ON user_oauth_tokens(user_id);
CREATE INDEX idx_user_oauth_tokens_provider ON user_oauth_tokens(provider);

-- Enable RLS
ALTER TABLE user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own tokens
CREATE POLICY "Users can view own tokens"
  ON user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_user_oauth_tokens_updated_at();

-- Comment for documentation
COMMENT ON TABLE user_oauth_tokens IS 'Stores OAuth tokens for external service integrations like Google Calendar';
COMMENT ON COLUMN user_oauth_tokens.provider IS 'Service provider identifier (e.g., google_calendar)';
COMMENT ON COLUMN user_oauth_tokens.scopes IS 'OAuth scopes granted for this token';
