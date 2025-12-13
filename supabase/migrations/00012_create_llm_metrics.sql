-- LLM Metrics table (for circuit breaker and monitoring)
CREATE TABLE llm_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  success BOOLEAN NOT NULL,
  latency_ms INTEGER NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE llm_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can view metrics
CREATE POLICY "Admins can view LLM metrics"
  ON llm_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- System can insert metrics
CREATE POLICY "System can insert LLM metrics"
  ON llm_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_llm_metrics_timestamp ON llm_metrics(timestamp DESC);
CREATE INDEX idx_llm_metrics_model ON llm_metrics(model);
CREATE INDEX idx_llm_metrics_fallback ON llm_metrics(is_fallback) WHERE is_fallback = TRUE;

-- Function to check fallback rate (rolling 24 hours)
CREATE OR REPLACE FUNCTION get_fallback_rate_24h()
RETURNS TABLE(
  total_requests BIGINT,
  fallback_requests BIGINT,
  fallback_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_requests,
    COUNT(*) FILTER (WHERE is_fallback = TRUE)::BIGINT AS fallback_requests,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE is_fallback = TRUE)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS fallback_percentage
  FROM llm_metrics
  WHERE timestamp > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log LLM request
CREATE OR REPLACE FUNCTION log_llm_request(
  p_model TEXT,
  p_is_fallback BOOLEAN,
  p_success BOOLEAN,
  p_latency_ms INTEGER,
  p_meeting_id UUID DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO llm_metrics (
    model, is_fallback, success, latency_ms, meeting_id, error_message
  ) VALUES (
    p_model, p_is_fallback, p_success, p_latency_ms, p_meeting_id, p_error_message
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

