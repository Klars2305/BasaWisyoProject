# Reproduction tests

Run `node --test tests/repro.test.mjs` from the `basawisyo` directory. The
test harness runs the actual application scripts in an isolated Node VM with
browser storage, file input, and event stubs. It uses only generated test data.

The suite covers BW-006 through BW-009, login and guest routing, backup
validation, legacy imports, repeat restores, and rollback after a failed
storage write. All 19 tests pass after step 4. `REPRO.md` records the original
failures and their fixes. These tests do not replace browser end-to-end
coverage.
