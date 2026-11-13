# Draft permissions matrix

**Status:** Proposed for project and school stakeholder review. These rules are
not implemented or approved. No real accounts or student records should be
used until server authorization and data isolation are built and tested.

## Scope and terms

- **Own** means the authenticated student's record, identified by a server
  session. The client cannot choose another `userId` to gain access.
- **Class** means a classroom the authenticated teacher is assigned to by a
  verified enrollment/ownership record. A share code can request enrollment;
  it is not proof of permission to read student data.
- **School** means the authenticated admin's assigned school. The draft grants
  no cross-school access.
- **Published** means a passage approved for learners under the shared passage
  contract. Drafts remain visible only to authorized editors/reviewers.
- A dash means deny. Every unlisted operation is denied by default.

## Proposed server-enforced matrix

| Operation or resource | Guest | Student | Teacher | School admin |
| --- | --- | --- | --- | --- |
| Read published passage catalog | Yes | Yes | Yes | Yes |
| Read draft passages | — | — | Own drafts, if teacher authoring is approved | School drafts |
| Create/edit passage drafts | — | — | Own drafts, if teacher authoring is approved | School curriculum drafts |
| Approve/publish passages | — | — | — | School curriculum, subject to approval policy |
| Run a reading or placement attempt | Local guest attempt only, pending guest policy | Own | Own only if teacher participation is approved | Own only if admin participation is approved |
| Read raw answers and progress | Local guest attempt only | Own | Enrolled class students only, subject to school policy | School students only, subject to school policy |
| Submit or correct another student's attempt | — | — | — | Manual correction only if approved and audited |
| Read classroom roster | — | Own enrollment only | Assigned class | School classes |
| Create/edit assignments | — | — | Assigned class | School classes, if administrative editing is approved |
| Read assignment and completion | — | Own assigned work | Assigned class | School classes |
| Join or leave a classroom | Request only, if guest linking is approved | Request or leave own enrollment under school policy | Approve/manage assigned class, if approved | Manage school enrollment |
| Edit profile/request password recovery | — | Own | Own | Own, plus school recovery if authorized |
| Change account role or status | — | — | — | School accounts, with audit and safeguards |
| Export reports | — | Own data, if offered | Assigned class | School scope |
| Export/restore full backup | — | — | — | Authorized school data steward only, with audit and recovery controls |

The matrix is a proposed target for server operations, not a description of
current access. The final policy must specify whether teachers may author
passages, who approves publication, whether staff may see raw answers, and
which admin actions require a second approver.

## Required enforcement checks

1. Authenticate each protected request on the server. Load the principal,
   active status, role, school, classroom membership, and resource ownership
   from trusted storage. Reject a suspended account and expired session.
2. Check both action and record scope before every read, write, export, and
   import. A page hidden in the UI does not protect the underlying operation.
3. Ignore client-supplied role, owner, school, and classroom claims for access
   decisions. Check object IDs against ownership or enrollment records.
4. Keep guest attempts separate from named student records. Linking a guest
   result must require an approved claim flow and prevent duplicate imports.
5. Record actor, action, target, time, and outcome for role changes, account
   suspension, publication, manual score changes, roster changes, and backups.
6. Test denials for forged roles, direct endpoint calls, changed resource IDs,
   another class or school, stale sessions, suspended users, and guest tokens.
   Test allowed cases with separate accounts and real server requests.

## Current-code evidence and gaps

- `src/services/auth.js` authenticates against plaintext users in localStorage,
  allows role selection at registration, and stores the current session in
  browser storage. `src/app.js` contains the admin registration key in client
  code. The new login screen changes entry flow but does not establish a trust
  boundary.
- `src/services/state.js` uses one origin-wide `basa_wisyo_state_v2` record.
  Student login can merge its words read into this shared state.
- `src/pages/admin.js` and `src/pages/teacher.js` check roles while rendering.
  Their data and action handlers still run in the browser. A share code links
  students to a teacher in local data, with no server enrollment check.
- `src/services/backup.js` can restore all local collections. That behavior is
  useful for the prototype but must be replaced or restricted before real
  school data is handled.

**Review owners:** project team and authorized school stakeholder. The
approved version should name the school data steward and record decisions on
teacher authoring, guest linking, report detail, and admin recovery rights.
