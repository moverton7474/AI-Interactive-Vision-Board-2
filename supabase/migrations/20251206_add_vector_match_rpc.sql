-- Function to match psychological frameworks using vector similarity
-- Required for amie-psychological-coach Edge Function

CREATE OR REPLACE FUNCTION match_psychological_frameworks (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  concept_name text,
  author text,
  content_chunk text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pf.id,
    pf.concept_name,
    pf.author,
    pf.content_chunk,
    1 - (pf.embedding <=> query_embedding) as similarity
  FROM psychological_frameworks pf
  WHERE 1 - (pf.embedding <=> query_embedding) > match_threshold
  ORDER BY pf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
