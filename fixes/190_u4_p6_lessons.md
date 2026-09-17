# 190 — C1/U4 lessons on P6 synthesize prompts

`p6SynthesisUserPrompt` / `p6SynthesisChunkUserPrompt` take optional `lessons`.
Empty/absent → **byte-identical** to the pre-U4 prompt. Nonempty → `PRIOR LESSONS`
block (advisory). Wired in `synthesizeSingleModule` and `synthesizeChunkedTree`
via `selectLessons` + `lessonLinesForBrief` (same as expandBrief).

Composer 189 accepted: Auto-Review no longer injects DoD PASS/FAIL; node-runner
redacts sk-/Bearer/API key from stdout/stderr. Owned 13/13.
