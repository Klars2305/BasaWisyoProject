# Reproduction tests

Run `node --test tests/repro.test.mjs` from the `basawisyo` directory. The
test harness runs the actual application scripts in an isolated Node VM with
browser storage, file input, and event stubs. It uses only generated test data.

Run `node --test --test-skip-pattern 'BW-008|BW-009' tests/repro.test.mjs`
to check the completed passage work with a green result.

After step 3, the control, BW-006, BW-007, legacy conversion, draft filtering,
teacher assignment, and text-escaping tests should pass. BW-008 and BW-009
remain expected failures until the separate backup/restore step. See
`REPRO.md` for the original failures and source locations. These tests do not
replace browser end-to-end coverage.
