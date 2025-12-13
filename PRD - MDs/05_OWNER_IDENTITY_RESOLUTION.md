# Owner Identity Resolution (MUST)

Goal: assign owners consistently using best available signals, and require human verification when uncertain.

## Resolution pipeline (apply in order)
1) **Direct match (MUST)**  
   - If attendee metadata includes an email, map that email to `profiles.id` and assign `owner_user_id`.

2) **Email inference (best effort)**  
   - If transcript contains a clear person name AND meeting metadata includes invites, attempt name-to-email association using invite display names.

3) **Conference-room heuristic (MUST)**  
   - If transcript identifies a single speaker responding as a room device AND only one attendee is present, infer that attendee as owner.
   - If multiple in-room participants are detected, set owner to **`Conference Room`** and require manual assignment.

4) **Fuzzy match (MUST)**  
   - Fuzzy match person name against the project roster.
   - Any fuzzy match **MUST** be surfaced in Review UI as **`Needs confirmation`**.

5) **Ambiguous (MUST)**  
   - If multiple matches exist, flag as **`Ambiguous Owner`** and require manual selection **before Publish**.

6) **Fallback (MUST)**  
   - Assign to **`Unknown`** and require manual resolution in Review UI for publishable items.

## Publish gate (MUST)
- Items with owner=`Unknown`, `Ambiguous Owner`, or `Conference Room` **MUST NOT** be published until the reviewer resolves the owner.
