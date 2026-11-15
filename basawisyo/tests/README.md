# Reproduction tests

Run `npm test`
from the `basawisyo` directory. The
test harness runs the actual application scripts in an isolated Node VM with
browser storage, file input, and event stubs. It uses only generated test data.

The suite covers BW-006 through BW-009, login and guest routing, backup
validation, legacy imports, repeat restores, and rollback after a failed
storage write. It also checks the guided journey, retry and tier rules,
teacher override scope, guest transfer, achievements, unique story counting,
class-board opt-in and class filtering, Student Profile and guest My Progress,
teacher/admin-only sample report actions, offline local reload, chat fallback,
device voice choice, recording cue alignment and fallback, and speech highlighting. `REPRO.md` records
the original failures and their fixes.
The isolated harness does not replace browser/device tests or a teacher pilot
of reading comprehension. Browser-local accounts are not server-authorized.

For the Profile and Reports flow, automated checks pass for guest, student,
teacher, and admin access; report action denial; account isolation; reload;
sample-data labeling; and report-dialog focus restoration. Small-screen layout,
complete keyboard traversal, and screen-reader behavior remain untested in a
live browser because the local origin browser permission gate denied access.
