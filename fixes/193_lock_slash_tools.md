# 193 — save lock + slash tools + error codes

## 174-13
`saveProject` takes an O_EXCL `.lock`. Concurrent writer → throw `RT_E_BUSY`.
Lock file is always unlinked in `finally`.

## Chat tools (first real actions)
Slash tools `/status` `/gate` `/packet` `/fixtures` `/help` run **keyless**
from grounded context. Free-text still needs DeepSeek. Not Codex-class
function-calling; first copilot *actions* that are not one-shot Q&A.

## Errors
`RT_E_BUSY` + `RT_E_FOREIGN_FILES` added to the taxonomy + docs.
