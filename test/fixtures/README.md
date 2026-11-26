# Fixtures

Every file here is **invented** for the tests. No real session, account or usage data.

- `claude/projects/**.jsonl`: fake Claude Code session files (with a duplicate streamed reply, a `<synthetic>` reply, a broken line).
- `claude/settings.json`: fake Claude Code settings.
- `statusline/*.json`: fake status line inputs, following https://code.claude.com/docs/en/statusline
  (`five_hour` resets 2026-11-26T09:00:00Z, `seven_day` resets 2026-11-27T00:00:00Z).
- `history-sample.jsonl`: fake claude-jauge history (5:00, 5:30, 6:00 UTC on 2026-11-26).
