# Issue tracker: Gitea

Issues and PRDs for this repo live in the self-hosted Gitea instance at git.np-dms.work:2222. Use the `gh` CLI with custom host configuration for all operations.

## Conventions

- **Configure `gh` for Gitea**: Run `gh auth login --hostname git.np-dms.work:2222` to authenticate
- **Create an issue**: `gh issue create --hostname git.np-dms.work:2222 --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --hostname git.np-dms.work:2222 --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --hostname git.np-dms.work:2222 --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --hostname git.np-dms.work:2222 --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --hostname git.np-dms.work:2222 --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --hostname git.np-dms.work:2222 --comment "..."`

Infer the repo from `git remote -v` — the origin is `ssh://git@git.np-dms.work:2222/np-dms/lcbp3.git`.

## When a skill says "publish to the issue tracker"

Create a Gitea issue using `gh issue create --hostname git.np-dms.work:2222`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --hostname git.np-dms.work:2222 --comments`.
