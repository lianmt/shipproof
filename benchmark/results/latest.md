# ShipProof controlled benchmark

- Generated: 2026-08-08T08:43:46.205Z
- Correct verdicts: 20/20
- False VERIFIED verdicts: 0

| Case | Expected | Actual | Result |
|---|---|---|---|
| clean-command | VERIFIED | VERIFIED | PASS |
| nonzero-exit | FAILED | FAILED | PASS |
| command-timeout | BLOCKED | BLOCKED | PASS |
| missing-required-output | FAILED | FAILED | PASS |
| forbidden-output | FAILED | FAILED | PASS |
| optional-failure | VERIFIED | VERIFIED | PASS |
| existing-file | VERIFIED | VERIFIED | PASS |
| missing-file | FAILED | FAILED | PASS |
| forbidden-file-text | FAILED | FAILED | PASS |
| minimum-size | FAILED | FAILED | PASS |
| missing-lock | UNVERIFIED | UNVERIFIED | PASS |
| protected-test-changed | UNVERIFIED | UNVERIFIED | PASS |
| config-changed | UNVERIFIED | UNVERIFIED | PASS |
| task-changed | UNVERIFIED | UNVERIFIED | PASS |
| http-pass | VERIFIED | VERIFIED | PASS |
| http-status-fail | FAILED | FAILED | PASS |
| http-body-fail | FAILED | FAILED | PASS |
| http-start-crash | BLOCKED | BLOCKED | PASS |
| stale-service-refused | BLOCKED | BLOCKED | PASS |
| stale-evidence | UNVERIFIED | UNVERIFIED | PASS |
