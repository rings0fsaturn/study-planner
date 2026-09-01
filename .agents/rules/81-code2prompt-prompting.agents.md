---
name: code2prompt-prompting
description: Build scoped LLM prompts from repository slices with the code2prompt CLI without leaking secrets.
---

# code2prompt Prompting

Use `code2prompt` to turn one scoped slice of this monorepo into an LLM prompt.
A run from the repository root produces about 5.7M tokens, which no model accepts.
Always pass a narrow PATH argument such as `apps/app/src/auth`, `packages/roadmap-engine`, or `services/intelligence/app`.

## Core invocation

Write the prompt to stdout and budget tokens in the same run:

```bash
code2prompt apps/app/src/onboarding -O - -e '*.test.*' \
  --encoding cl100k --token-format format
```

The prompt goes to stdout while progress lines and the token count go to stderr.
Use `--token-format raw` when a script needs a machine-parsable number.

## Filtering and safety

Default traversal respects `.gitignore`, so `node_modules/`, `dist/`, and env files stay out of the prompt automatically.
Never pass `--no-ignore`: the gitignored env files in this checkout hold real secrets.
Prefer an explicit subpath over `--hidden`, which pulls the whole `.work/` corpus into the prompt.
Read one tracked spec or plan through its explicit path instead, for example `code2prompt .work/specs/issues/<file> -O -`.
Narrow further with `-i` and `-e` globs, for example `-i '*.ts' -e '**/*.test.*'`.

## Output formats

Use `-F json` from scripts: it returns `files`, `model_info`, and the assembled `prompt` as fields.
Use `-F xml` when feeding another agent that prefers tagged `<file path>` sections.
Use `-c` only when handing the prompt to a human clipboard workflow.

## Git flags

`-d`, `--git-diff-branch`, and `--git-log-branch` render nothing in the default template because diffs surface only through custom Handlebars templates.
Build review prompts by piping plain `git diff main...HEAD` alongside a scoped `code2prompt` slice instead.
The branch diff flags also fail with `could not find repository` whenever PATH points below the repository root.