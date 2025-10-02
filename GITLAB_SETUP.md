# GitLab Integration Setup Guide

Minimal instructions for enabling Claude Code reviews on GitLab merge requests.

## 1. Create a Project Access Token

1. In your GitLab project go to **Settings → Access Tokens**.
2. Create a **Project Access Token** with the scopes:
   - `api` (required for MR comments)
   - `read_repository`
   - `write_repository` *(only if you want Claude to push commits)*
3. Copy the token value.

## 2. Configure CI/CD Variables

Add the following masked variables under **Settings → CI/CD → Variables**:

| Key | Value |
| --- | --- |
| `GITLAB_TOKEN` | the project access token from step 1 |
| `ANTHROPIC_API_KEY` | your Anthropic API key |

## 3. Pipeline Configuration

Place the job below in your repository’s `.gitlab-ci.yml`. Update the `git clone` URL to point to your fork if needed.

```yaml
stages:
  - claude

claude-code-review:
  stage: claude
  image: node:20
  variables:
    CI_PLATFORM: "gitlab"
    GITLAB_TOKEN: $GITLAB_TOKEN
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
  rules:
    - if: $CI_MERGE_REQUEST_IID
      when: manual
  before_script:
    - npm install -g bun
    - git clone https://github.com/ayurkevichdh/claude-code-gitlab.git claude-action
    - cd claude-action
    - bun install
  script:
    - bun run src/entrypoints/prepare.ts
    - bun run src/entrypoints/call-claude-api.ts
    - bun run src/entrypoints/claude-reviewer.ts
```

### How it works

1. `prepare.ts` detects the trigger (MR description/comment) and posts an initial progress note.
2. `call-claude-api.ts` runs the Claude Code action to analyze the merge request.
3. `claude-reviewer.ts` parses Claude’s output and posts inline review comments plus a summary.

Trigger the job manually from the merge-request pipeline (or adjust the `rules` to run automatically when a trigger phrase is detected).

## 4. Verify the Integration

1. Open a merge request, mention `@claude` in the description or a comment, and run the `claude-code-review` job.
2. Check the pipeline logs for successful execution.
3. Confirm that Claude posts inline comments and a summary note in the merge request.

For troubleshooting, run the repo’s GitLab-specific tests locally with `bun test test/gitlab-*.test.ts`.