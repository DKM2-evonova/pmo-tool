# LLM Output Contract (Canonical JSON)

> **Schema Version**: `pmo_tool.v1`

This document defines the authoritative JSON schema that all LLM outputs must conform to.

---

## Contract Principles

1. The LLM **MUST** return valid JSON matching this contract
2. The backend **MUST** validate the payload
3. If invalid, the utility model **MUST** attempt repair
4. If repair fails, the meeting **MUST** be marked `Failed`
5. All enum values **MUST** match exactly as specified

---

## Required Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | Yes | Must be `"pmo_tool.v1"` |
| `meeting` | object | Yes | Meeting metadata |
| `recap` | object | Yes | Meeting summary and highlights |
| `tone` | object | Yes | Tone analysis (Alignment meetings) |
| `action_items` | array | Yes | Action items (may be empty) |
| `decisions` | array | Yes | Decisions (may be empty) |
| `risks` | array | Yes | Risks/issues (may be empty) |
| `fishbone` | object | Yes | Fishbone diagram (Remediation meetings) |

---

## Fishbone Rules

- If `meeting.category` is `Remediation`: `fishbone.enabled` **MUST** be `true` and `fishbone.outline` **MUST** be populated
- If `meeting.category` is NOT `Remediation`: `fishbone.enabled` **MUST** be `false`

---

## Complete JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schema_version", "meeting", "recap", "tone", "action_items", "decisions", "risks", "fishbone"],
  "properties": {
    "schema_version": {
      "const": "pmo_tool.v1"
    },
    "meeting": {
      "type": "object",
      "required": ["category", "title", "date", "attendees"],
      "properties": {
        "category": {
          "enum": ["Project", "Governance", "Discovery", "Alignment", "Remediation"]
        },
        "title": {
          "type": "string"
        },
        "date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "attendees": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "email"],
            "properties": {
              "name": { "type": "string" },
              "email": { "type": ["string", "null"] }
            }
          }
        }
      }
    },
    "recap": {
      "type": "object",
      "required": ["summary", "highlights", "key_topics", "action_items_summary", "outstanding_topics"],
      "properties": {
        "summary": {
          "type": "string",
          "description": "2-3 paragraph executive summary of the meeting"
        },
        "highlights": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Brief key points from the meeting"
        },
        "key_topics": {
          "type": "array",
          "description": "3-5 major discussion topics with detailed context",
          "items": {
            "type": "object",
            "required": ["topic", "discussion", "participants", "outcome"],
            "properties": {
              "topic": { "type": "string" },
              "discussion": {
                "type": "string",
                "description": "Detailed summary of what was discussed (2-4 sentences)"
              },
              "participants": {
                "type": "array",
                "items": { "type": "string" }
              },
              "outcome": {
                "type": ["string", "null"],
                "description": "Resolution reached, or null if still open"
              }
            }
          }
        },
        "action_items_summary": {
          "type": "array",
          "description": "Summary of action items for quick recap display",
          "items": {
            "type": "object",
            "required": ["title", "owner", "due_date", "status"],
            "properties": {
              "title": { "type": "string" },
              "owner": { "type": "string" },
              "due_date": {
                "type": ["string", "null"],
                "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
              },
              "status": {
                "enum": ["Open", "In Progress", "Closed"]
              }
            }
          }
        },
        "outstanding_topics": {
          "type": "array",
          "description": "Topics raised but not resolved in this meeting",
          "items": {
            "type": "object",
            "required": ["topic", "context", "blockers", "suggested_next_steps"],
            "properties": {
              "topic": { "type": "string" },
              "context": {
                "type": "string",
                "description": "Why this topic was raised and what was discussed"
              },
              "blockers": {
                "type": "array",
                "items": { "type": "string" }
              },
              "suggested_next_steps": {
                "type": "array",
                "items": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "tone": {
      "type": "object",
      "required": ["overall", "participants"],
      "properties": {
        "overall": { "type": "string" },
        "participants": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "tone", "happiness", "buy_in"],
            "properties": {
              "name": { "type": "string" },
              "tone": { "type": "string" },
              "happiness": { "enum": ["Low", "Med", "High"] },
              "buy_in": { "enum": ["Low", "Med", "High"] }
            }
          }
        }
      }
    },
    "action_items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation", "external_id", "title", "description", "status", "owner", "due_date", "evidence"],
        "properties": {
          "operation": {
            "enum": ["create", "update", "close"]
          },
          "external_id": {
            "type": ["string", "null"],
            "description": "ID of existing item for update/close operations"
          },
          "title": { "type": "string" },
          "description": { "type": "string" },
          "status": {
            "enum": ["Open", "In Progress", "Closed"]
          },
          "change_summary": {
            "type": ["string", "null"],
            "description": "What changed (for update/close operations)"
          },
          "owner": {
            "type": "object",
            "required": ["name", "email"],
            "properties": {
              "name": { "type": "string" },
              "email": { "type": ["string", "null"] }
            }
          },
          "due_date": {
            "type": ["string", "null"],
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "evidence": {
            "type": "array",
            "minItems": 1,
            "items": {
              "$ref": "#/$defs/evidence"
            }
          }
        }
      }
    },
    "decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation", "title", "rationale", "impact", "decision_maker", "outcome", "evidence"],
        "properties": {
          "operation": {
            "enum": ["create", "update"]
          },
          "title": { "type": "string" },
          "rationale": { "type": "string" },
          "impact": { "type": "string" },
          "category": {
            "enum": ["process", "technology", "data", "people", "governance", "strategy"],
            "description": "Auto-classified by LLM"
          },
          "impact_areas": {
            "type": "array",
            "items": {
              "enum": ["scope", "cost", "time", "risk", "customer_experience"]
            },
            "description": "Multi-select impact areas"
          },
          "decision_maker": {
            "type": "object",
            "required": ["name", "email"],
            "properties": {
              "name": { "type": "string" },
              "email": { "type": ["string", "null"] }
            }
          },
          "outcome": { "type": "string" },
          "evidence": {
            "type": "array",
            "minItems": 1,
            "items": {
              "$ref": "#/$defs/evidence"
            }
          }
        }
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation", "title", "description", "probability", "impact", "mitigation", "owner", "status", "evidence"],
        "properties": {
          "operation": {
            "enum": ["create", "update", "close"]
          },
          "title": { "type": "string" },
          "description": { "type": "string" },
          "probability": {
            "enum": ["Low", "Med", "High"]
          },
          "impact": {
            "enum": ["Low", "Med", "High"]
          },
          "mitigation": { "type": "string" },
          "owner": {
            "type": "object",
            "required": ["name", "email"],
            "properties": {
              "name": { "type": "string" },
              "email": { "type": ["string", "null"] }
            }
          },
          "status": {
            "enum": ["Open", "In Progress", "Closed"]
          },
          "evidence": {
            "type": "array",
            "minItems": 1,
            "items": {
              "$ref": "#/$defs/evidence"
            }
          }
        }
      }
    },
    "fishbone": {
      "type": "object",
      "required": ["enabled"],
      "properties": {
        "enabled": { "type": "boolean" },
        "outline": {
          "type": ["object", "null"],
          "properties": {
            "problem_statement": { "type": "string" },
            "categories": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["name", "causes"],
                "properties": {
                  "name": { "type": "string" },
                  "causes": {
                    "type": "array",
                    "items": { "type": "string" }
                  }
                }
              }
            }
          }
        },
        "rendered": {
          "type": ["object", "null"],
          "properties": {
            "format": { "const": "svg" },
            "payload": { "type": "string" }
          }
        }
      }
    }
  },
  "$defs": {
    "evidence": {
      "type": "object",
      "required": ["quote", "speaker", "timestamp"],
      "properties": {
        "quote": {
          "type": "string",
          "description": "Direct quote from transcript"
        },
        "speaker": {
          "type": ["string", "null"],
          "description": "Name of speaker if identifiable"
        },
        "timestamp": {
          "type": ["string", "null"],
          "pattern": "^\\d{2}:\\d{2}:\\d{2}$",
          "description": "Timestamp in HH:MM:SS format"
        }
      }
    }
  }
}
```

---

## Example Output

```json
{
  "schema_version": "pmo_tool.v1",
  "meeting": {
    "category": "Project",
    "title": "Sprint Planning - Q1 2026",
    "date": "2026-01-04",
    "attendees": [
      { "name": "Alice Smith", "email": "alice@company.com" },
      { "name": "Bob Jones", "email": null }
    ]
  },
  "recap": {
    "summary": "The team discussed the Q1 roadmap priorities...",
    "highlights": ["Agreed on 3 key initiatives", "Budget approved"],
    "key_topics": [],
    "action_items_summary": [],
    "outstanding_topics": []
  },
  "tone": {
    "overall": "Collaborative and productive",
    "participants": []
  },
  "action_items": [
    {
      "operation": "create",
      "external_id": null,
      "title": "Draft Q1 roadmap document",
      "description": "Create detailed roadmap with milestones",
      "status": "Open",
      "owner": { "name": "Alice Smith", "email": "alice@company.com" },
      "due_date": "2026-01-15",
      "evidence": [
        {
          "quote": "Alice, can you draft up that roadmap by mid-month?",
          "speaker": "Bob Jones",
          "timestamp": "00:15:32"
        }
      ]
    }
  ],
  "decisions": [],
  "risks": [],
  "fishbone": {
    "enabled": false
  }
}
```
