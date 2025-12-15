# Owner Identity Resolution (MUST)

Goal: assign owners consistently using best available signals, and require human verification when uncertain.

## People Sources
Resolution matches against two sources:
- **Project Members** (users with login accounts in `profiles`)
- **Project Contacts** (people without login accounts in `project_contacts`)

Both sources are included in the fuzzy matching pool and owner selection dropdowns.

## Resolution pipeline (apply in order)
1) **Direct email match - Users (MUST)**
   - If attendee metadata includes an email, map that email to `profiles.id` and assign `owner_user_id`.

2) **Direct email match - Contacts (MUST)**
   - If no user match, check `project_contacts` for email match and assign `owner_contact_id`.

3) **Email inference (best effort)**
   - If transcript contains a clear person name AND meeting metadata includes invites, attempt name-to-email association using invite display names.
   - Check against both project members and project contacts.

4) **Conference-room heuristic (MUST)**
   - If transcript identifies a single speaker responding as a room device AND only one attendee is present, infer that attendee as owner.
   - If multiple in-room participants are detected, set owner to **`Conference Room`** and require manual assignment.

5) **Fuzzy match (MUST)**
   - Fuzzy match person name against the combined project roster (members + contacts).
   - Any fuzzy match **MUST** be surfaced in Review UI as **`Needs confirmation`**.

6) **Ambiguous (MUST)**
   - If multiple matches exist, flag as **`Ambiguous Owner`** and require manual selection **before Publish**.

7) **Fallback (MUST)**
   - Assign to **`Unknown`** and require manual resolution in Review UI for publishable items.

## Publish gate (MUST)
- Items with owner=`Unknown`, `Ambiguous Owner`, or `Conference Room` **MUST NOT** be published until the reviewer resolves the owner.
