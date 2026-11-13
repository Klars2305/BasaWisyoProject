# Reproduction tests

Run `node --test tests/repro.test.mjs` from the `basawisyo` directory. The
test harness runs the actual application scripts in an isolated Node VM with
browser storage, file input, and event stubs. It uses only generated test data.

The control test should pass. BW-006 through BW-009 should fail against the
current application; this is the expected red baseline before behavior fixes.
See `REPRO.md` for the observed failures and source locations. These tests do
not replace browser end-to-end coverage.
