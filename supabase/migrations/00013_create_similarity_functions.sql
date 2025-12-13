-- Similarity search functions for duplicate detection

-- Match action items by embedding similarity
CREATE OR REPLACE FUNCTION match_action_items(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    action_items.id,
    action_items.title,
    1 - (action_items.embedding <=> query_embedding) as similarity
  FROM action_items
  WHERE action_items.project_id = p_project_id
    AND action_items.embedding IS NOT NULL
    AND 1 - (action_items.embedding <=> query_embedding) > match_threshold
  ORDER BY action_items.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Match decisions by embedding similarity
CREATE OR REPLACE FUNCTION match_decisions(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    decisions.id,
    decisions.title,
    1 - (decisions.embedding <=> query_embedding) as similarity
  FROM decisions
  WHERE decisions.project_id = p_project_id
    AND decisions.embedding IS NOT NULL
    AND 1 - (decisions.embedding <=> query_embedding) > match_threshold
  ORDER BY decisions.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Match risks by embedding similarity
CREATE OR REPLACE FUNCTION match_risks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    risks.id,
    risks.title,
    1 - (risks.embedding <=> query_embedding) as similarity
  FROM risks
  WHERE risks.project_id = p_project_id
    AND risks.embedding IS NOT NULL
    AND 1 - (risks.embedding <=> query_embedding) > match_threshold
  ORDER BY risks.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Generic similarity search across all entity types
CREATE OR REPLACE FUNCTION search_similar_items(
  query_embedding vector(1536),
  p_project_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  entity_type text,
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT * FROM (
    SELECT
      'action_item'::text as entity_type,
      action_items.id,
      action_items.title,
      1 - (action_items.embedding <=> query_embedding) as similarity
    FROM action_items
    WHERE action_items.project_id = p_project_id
      AND action_items.embedding IS NOT NULL
      AND 1 - (action_items.embedding <=> query_embedding) > match_threshold
    
    UNION ALL
    
    SELECT
      'decision'::text as entity_type,
      decisions.id,
      decisions.title,
      1 - (decisions.embedding <=> query_embedding) as similarity
    FROM decisions
    WHERE decisions.project_id = p_project_id
      AND decisions.embedding IS NOT NULL
      AND 1 - (decisions.embedding <=> query_embedding) > match_threshold
    
    UNION ALL
    
    SELECT
      'risk'::text as entity_type,
      risks.id,
      risks.title,
      1 - (risks.embedding <=> query_embedding) as similarity
    FROM risks
    WHERE risks.project_id = p_project_id
      AND risks.embedding IS NOT NULL
      AND 1 - (risks.embedding <=> query_embedding) > match_threshold
  ) combined
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

