-- Function to get average processing time from recent successful requests
-- This is SECURITY DEFINER so any authenticated user can call it without accessing the full table
CREATE OR REPLACE FUNCTION get_avg_processing_time_ms()
RETURNS TABLE(
  avg_latency_ms INTEGER,
  sample_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(latency_ms)::INTEGER, 30000) AS avg_latency_ms,
    COUNT(*)::INTEGER AS sample_count
  FROM llm_metrics
  WHERE success = TRUE
    AND timestamp > NOW() - INTERVAL '7 days'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_avg_processing_time_ms() TO authenticated;
