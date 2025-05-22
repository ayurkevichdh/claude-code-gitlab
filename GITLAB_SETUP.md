# GitLab Integration Setup Guide

This guide will help you set up Claude Code to work with your GitLab repositories.

## Prerequisites

1. **GitLab Account** with a project/repository
2. **Anthropic API Key** for Claude access
3. **GitLab Access Token** with appropriate permissions

## Step 1: Create GitLab Access Token

1. Go to your GitLab instance → User Settings → Access Tokens
2. Create a new token with these scopes:
   - `api` - Full access to the API
   - `read_user` - Read user information
   - `read_repository` - Read repository data
   - `write_repository` - Write repository data (for commits/pushes)

3. Copy the token - you'll need it later

## Step 2: Set Up GitLab CI/CD Variables

In your GitLab project, go to Settings → CI/CD → Variables and add:

### Required Variables:
- `GITLAB_TOKEN` - Your GitLab access token from Step 1
- `ANTHROPIC_API_KEY` - Your Anthropic API key

### Optional Variables:
- `TRIGGER_PHRASE` - Custom trigger phrase (default: `@claude`)
- `ANTHROPIC_MODEL` - Claude model to use (default: `claude-3-7-sonnet-20250219`)

## Step 3: Add GitLab CI Configuration

Create or update your `.gitlab-ci.yml` file in your repository root:

```yaml
stages:
  - claude

variables:
  # Set platform to GitLab
  CI_PLATFORM: "gitlab"

# Claude AI code assistance for merge requests
claude-code:
  stage: claude
  image: node:20
  rules:
    # Trigger on merge request events
    - if: $CI_MERGE_REQUEST_IID
      when: manual
  script:
    # Setup Node.js and install dependencies
    - npm install -g bun
    - git clone https://github.com/yourusername/claude-code-gitlab.git claude-action
    - cd claude-action && bun install
    
    # Run Claude preparation step
    - bun run src/entrypoints/prepare.ts
    
    # Run Claude Code (replace with actual claude-code command)
    - echo "Claude Code would run here"
    
  variables:
    # Required tokens (from CI/CD variables)
    GITLAB_TOKEN: $GITLAB_TOKEN
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
    
    # GitLab context (auto-provided by GitLab CI)
    CI_PROJECT_ID: $CI_PROJECT_ID
    CI_MERGE_REQUEST_IID: $CI_MERGE_REQUEST_IID
    CI_SERVER_URL: $CI_SERVER_URL
    
    # Claude configuration
    TRIGGER_PHRASE: "@claude"
    ANTHROPIC_MODEL: "claude-3-7-sonnet-20250219"
    
  artifacts:
    paths:
      - claude-output.json
    expire_in: 1 week
    when: always
```

## Step 4: Testing the Integration

### Manual Testing

1. **Create a Merge Request** in your GitLab project
2. **Add a comment** with your trigger phrase (default: `@claude`)
3. **Manually trigger** the `claude-code` pipeline job
4. **Check the job logs** to see if Claude responds

### Test Commands

```bash
# Test GitLab context parsing
bun test test/gitlab-context.test.ts

# Test GitLab provider functionality  
bun test test/gitlab-provider.test.ts

# Test GitLab trigger validation
bun test test/gitlab-trigger-validation.test.ts

# Test GitLab token setup
bun test test/gitlab-token.test.ts

# Run all tests
bun test
```

## Step 5: Usage Examples

### Trigger Claude in Merge Requests

1. **Comment on MR**: `@claude please review this code`
2. **MR Description**: Include `@claude` to trigger on MR creation
3. **Direct Prompt**: Set `DIRECT_PROMPT` variable for automatic triggering

### Available Commands

- `@claude review this code` - Code review
- `@claude fix the failing tests` - Fix test issues  
- `@claude add documentation` - Add/improve docs
- `@claude optimize this function` - Performance improvements

## Troubleshooting

### Common Issues

1. **Token Authentication Errors**
   - Verify `GITLAB_TOKEN` has correct permissions
   - Check token hasn't expired
   - Ensure `ANTHROPIC_API_KEY` is valid

2. **Pipeline Not Triggering**
   - Check GitLab CI rules in `.gitlab-ci.yml`
   - Verify merge request exists (`CI_MERGE_REQUEST_IID` set)
   - Check trigger phrase matches exactly

3. **Permission Errors**
   - Ensure GitLab token has `api` and `write_repository` scopes
   - Check project visibility settings
   - Verify CI/CD pipelines are enabled

### Debug Steps

1. **Check CI Variables**:
   ```bash
   echo "Project ID: $CI_PROJECT_ID"
   echo "MR IID: $CI_MERGE_REQUEST_IID" 
   echo "Server URL: $CI_SERVER_URL"
   ```

2. **Test GitLab API Access**:
   ```bash
   curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        "$CI_SERVER_URL/api/v4/projects/$CI_PROJECT_ID"
   ```

3. **Verify Trigger Detection**:
   ```bash
   # Test trigger phrase locally
   bun test test/gitlab-trigger-validation.test.ts
   ```

## Architecture Notes

### Key Components

- **`src/gitlab/context.ts`** - GitLab context parsing
- **`src/gitlab/validation/trigger.ts`** - Trigger detection for GitLab
- **`src/providers/gitlab.ts`** - GitLab API integration
- **`src/providers/gitlab/token.ts`** - Token management

### Differences from GitHub

- Uses GitLab API instead of GitHub API
- Different webhook payload structure
- Different environment variables (`CI_*` instead of `GITHUB_*`)
- Different permission model (access tokens vs GitHub Apps)

## Security Considerations

1. **Token Security**
   - Store tokens in GitLab CI/CD variables (masked)
   - Use minimal required permissions
   - Rotate tokens regularly

2. **Access Control**
   - Limit who can trigger manual jobs
   - Review CI/CD variable access
   - Monitor pipeline activity

3. **API Limits**
   - Be aware of GitLab API rate limits
   - Monitor Anthropic API usage
   - Consider caching strategies

## Next Steps

1. **Customize** the trigger phrases for your team
2. **Extend** functionality with additional Claude tools
3. **Monitor** usage and performance
4. **Iterate** based on team feedback

For more help, check the test files for usage examples or open an issue in the repository.