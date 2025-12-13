# Context-Aware Matching, Duplicates, and Embeddings (MUST)

## Context injection (MUST)
- Before LLM processing, the backend **MUST** load **ALL open** `action_items`, `risks`, and `decisions` for the selected project.
- These open items **MUST** be passed into the LLM context to favor `update|close` over `create` and reduce duplicates.

## Closure inference (allowed, constrained)
- The model **MAY** propose `close` when language indicates completion (e.g., “done”, “completed”, “shipped”).
- Closure proposals **MUST** include supporting `evidence` quotes.

## Token-limit handling (MUST)
- If injecting all open items exceeds context length, the system **MUST** process in batches (multi-pass) and **MUST** merge results deterministically.

## Duplicate detection (MUST)
- For newly proposed items, the backend **MUST** generate embeddings and flag as `Potential Duplicate` when similarity `> 0.85`.
- The threshold **SHOULD** be configurable per deployment, but **MUST** default to `0.85`.

## Embedding lifecycle (MUST)
- Embeddings **MUST** be generated or regenerated on **Publish**.
- Any update to an item’s description **MUST** trigger an embedding refresh on Publish.
