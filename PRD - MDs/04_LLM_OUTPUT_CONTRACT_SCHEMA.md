# LLM Output Contract (Canonical JSON) — MUST

## Contract principles
- The LLM **MUST** return **valid JSON** matching this contract.
- The backend **MUST** validate the payload; if invalid, it **MUST** be repaired using the utility model, otherwise the meeting **MUST** be marked `Failed`.
- Enums **MUST** match `02_ENUMS_AND_CONSTANTS.md` exactly.

## Required top-level
- `schema_version` **MUST** be `"pmo_tool.v1"`.
- `meeting` **MUST** be present.
- `recap` **MUST** be present.
- `action_items`, `decisions`, `risks` **MUST** be present as arrays (empty array allowed).
- `fishbone` **MUST** be present as an object.

## Fishbone rules
- If `meeting.category` is `Remediation`, then `fishbone.enabled` **MUST** be `true` and `fishbone.outline` **MUST** be populated.
- If `meeting.category` is NOT `Remediation`, then `fishbone.enabled` **MUST** be `false` and `fishbone.outline` and `fishbone.rendered` **MUST** be omitted or set to `null`.

## Minimal JSON Schema (draft-2020-12 style, trimmed)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schema_version","meeting","recap","tone","action_items","decisions","risks","fishbone"],
  "properties": {
    "schema_version": {"const": "pmo_tool.v1"},
    "meeting": {
      "type": "object",
      "required": ["category","title","date","attendees"],
      "properties": {
        "category": {"enum": ["Project","Governance","Discovery","Alignment","Remediation"]},
        "title": {"type": "string"},
        "date": {"type": "string", "pattern": "^\d{4}-\d{2}-\d{2}$"},
        "attendees": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name","email"],
            "properties": {
              "name": {"type": "string"},
              "email": {"type": ["string","null"]}
            }
          }
        }
      }
    },
    "recap": {
      "type": "object",
      "required": ["summary","highlights"],
      "properties": {
        "summary": {"type": "string"},
        "highlights": {"type": "array", "items": {"type": "string"}}
      }
    },
    "tone": {
      "type": "object",
      "required": ["overall","participants"],
      "properties": {
        "overall": {"type": "string"},
        "participants": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name","tone","happiness","buy_in"],
            "properties": {
              "name": {"type": "string"},
              "tone": {"type": "string"},
              "happiness": {"enum": ["Low","Med","High"]},
              "buy_in": {"enum": ["Low","Med","High"]}
            }
          }
        }
      }
    },
    "action_items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation","external_id","title","description","status","owner","due_date","evidence"],
        "properties": {
          "operation": {"enum": ["create","update","close"]},
          "external_id": {"type": ["string","null"]},
          "title": {"type": "string"},
          "description": {"type": "string"},
          "status": {"enum": ["Open","In Progress","Closed"]},
          "owner": {
            "type": "object",
            "required": ["name","email"],
            "properties": {"name": {"type":"string"}, "email": {"type":["string","null"]}}
          },
          "due_date": {"type": ["string","null"], "pattern": "^\d{4}-\d{2}-\d{2}$"},
          "evidence": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": ["quote","speaker","timestamp"],
              "properties": {
                "quote": {"type": "string"},
                "speaker": {"type": ["string","null"]},
                "timestamp": {"type": ["string","null"], "pattern": "^\d{2}:\d{2}:\d{2}$"}
              }
            }
          }
        }
      }
    },
    "decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation","title","rationale","impact","decision_maker","outcome","evidence"],
        "properties": {
          "operation": {"enum": ["create","update"]},
          "title": {"type": "string"},
          "rationale": {"type": "string"},
          "impact": {"type": "string"},
          "decision_maker": {
            "type": "object",
            "required": ["name","email"],
            "properties": {"name": {"type":"string"}, "email": {"type":["string","null"]}}
          },
          "outcome": {"type": "string"},
          "evidence": {"type": "array", "minItems": 1, "items": {"$ref": "#/properties/action_items/items/properties/evidence/items"}}
        }
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["operation","title","description","probability","impact","mitigation","owner","status","evidence"],
        "properties": {
          "operation": {"enum": ["create","update","close"]},
          "title": {"type": "string"},
          "description": {"type": "string"},
          "probability": {"enum": ["Low","Med","High"]},
          "impact": {"enum": ["Low","Med","High"]},
          "mitigation": {"type": "string"},
          "owner": {
            "type": "object",
            "required": ["name","email"],
            "properties": {"name": {"type":"string"}, "email": {"type":["string","null"]}}
          },
          "status": {"enum": ["Open","In Progress","Closed"]},
          "evidence": {"type": "array", "minItems": 1, "items": {"$ref": "#/properties/action_items/items/properties/evidence/items"}}
        }
      }
    },
    "fishbone": {
      "type": "object",
      "required": ["enabled"],
      "properties": {
        "enabled": {"type": "boolean"},
        "outline": {
          "type": ["object","null"],
          "properties": {
            "problem_statement": {"type":"string"},
            "categories": {
              "type":"array",
              "items": {"type":"object","required":["name","causes"],"properties":{"name":{"type":"string"},"causes":{"type":"array","items":{"type":"string"}}}}
            }
          }
        },
        "rendered": {
          "type": ["object","null"],
          "properties": {
            "format": {"const":"svg"},
            "payload": {"type":"string"}
          }
        }
      }
    }
  }
}
```
