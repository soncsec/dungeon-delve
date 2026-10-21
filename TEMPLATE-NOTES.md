# Template notes

Setup changes made in Dungeon Delve that would help every game. Input for `soncsec/game-template` (changes there go through the owner).

| Change | Where | Why |
|---|---|---|
| Local test runs are limited: Playwright `workers: 2`, and long runs and releases go through `scripts/limit-cpu.sh` (low priority with `nice`, at most 4 cores via `systemd-run --user --scope -p CPUQuota=400%`); start a release or a full e2e run only when the 1- and 5-minute load averages are both under 35 | `playwright.config.ts`, `scripts/limit-cpu.sh`, README | On 2026-10-21 heavy test runs from several sessions pushed the shared machine's load to 60–85, and other games' tests and releases timed out (owner request; same change as soncsec/contro #93) |
