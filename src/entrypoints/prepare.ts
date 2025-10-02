#!/usr/bin/env bun

/**
 * Prepare the Claude action by checking trigger conditions, verifying human actor,
 * and creating the initial tracking comment
 */

import * as core from "@actions/core";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { setupGitHubToken } from "../github/token";
import { checkWritePermissions } from "../github/validation/permissions";
import { createOctokit } from "../github/api/client";
import { parseGitHubContext, isEntityContext } from "../github/context";
import { getMode } from "../modes/registry";
import { prepare } from "../prepare";
import { collectActionInputsPresence } from "./collect-inputs";
import { getProvider } from "../providers/provider-factory";
import type { ParsedGitLabContext } from "../gitlab/context";
import { checkTriggerAction as checkGitLabTriggerAction } from "../gitlab/validation/trigger";
import type { GitLabMergeRequestEvent, GitLabNoteEvent } from "../gitlab/validation/trigger";
import { fetchGitLabMRData } from "../gitlab/data/fetcher";
import { checkTriggerAction } from "../github/validation/trigger";

async function runGitHubFlow() {
  try {
    collectActionInputsPresence();

    // Parse GitHub context first to enable mode detection
    const context = parseGitHubContext();

    // Auto-detect mode based on context
    const mode = getMode(context);

    // Setup GitHub token
    const githubToken = await setupGitHubToken();
    const octokit = createOctokit(githubToken);

    // Step 3: Check write permissions (only for entity contexts)
    if (isEntityContext(context)) {
      // Check if github_token was provided as input (not from app)
      const githubTokenProvided = !!process.env.OVERRIDE_GITHUB_TOKEN;
      const hasWritePermissions = await checkWritePermissions(
        octokit.rest,
        context,
        context.inputs.allowedNonWriteUsers,
        githubTokenProvided,
      );
      if (!hasWritePermissions) {
        throw new Error(
          "Actor does not have write permissions to the repository",
        );
      }
    }

    // Check trigger conditions
    const containsTrigger = mode.shouldTrigger(context);

    // Debug logging
    console.log(`Mode: ${mode.name}`);
    console.log(`Context prompt: ${context.inputs?.prompt || "NO PROMPT"}`);
    console.log(`Trigger result: ${containsTrigger}`);

    // Set output for action.yml to check
    core.setOutput("contains_trigger", containsTrigger.toString());

    if (!containsTrigger) {
      console.log("No trigger found, skipping remaining steps");
      // Still set github_token output even when skipping
      core.setOutput("github_token", githubToken);
      return;
    }

    // Step 5: Use the new modular prepare function
    const result = await prepare({
      context,
      octokit,
      mode,
      githubToken,
    });

    // MCP config is handled by individual modes (tag/agent) and included in their claude_args output

    // Expose the GitHub token (Claude App token) as an output
    core.setOutput("github_token", githubToken);

    // Step 6: Get system prompt from mode if available
    if (mode.getSystemPrompt) {
      const modeContext = mode.prepareContext(context, {
        commentId: result.commentId,
        baseBranch: result.branchInfo.baseBranch,
        claudeBranch: result.branchInfo.claudeBranch,
      });
      const systemPrompt = mode.getSystemPrompt(modeContext);
      if (systemPrompt) {
        core.exportVariable("APPEND_SYSTEM_PROMPT", systemPrompt);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Prepare step failed with error: ${errorMessage}`);
    // Also output the clean error message for the action to capture
    core.setOutput("prepare_error", errorMessage);
    process.exit(1);
  }
}

async function runGitLabFlow(context: ParsedGitLabContext) {
  try {
    const triggerPhrase = process.env.TRIGGER_PHRASE || "@claude";
    const directPrompt = process.env.DIRECT_PROMPT || "";

    let payload: GitLabMergeRequestEvent | GitLabNoteEvent = {
      object_kind: "merge_request",
      object_attributes: {},
    } as GitLabMergeRequestEvent;

    if (process.env.GITLAB_WEBHOOK_PAYLOAD) {
      try {
        payload = JSON.parse(process.env.GITLAB_WEBHOOK_PAYLOAD);
      } catch (error) {
        console.warn("Failed to parse GITLAB_WEBHOOK_PAYLOAD, falling back to default payload", error);
      }
    }

    const containsTrigger = await checkGitLabTriggerAction({
      payload,
      inputs: { triggerPhrase, directPrompt },
    });

    core.setOutput("contains_trigger", containsTrigger.toString());

    if (!containsTrigger) {
      console.log("No trigger found, skipping remaining steps");
      return;
    }

    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      throw new Error("GITLAB_TOKEN is required for GitLab runs");
    }

    console.log("GitLab mode - fetching MR data and generating prompt");

    if (!context.mrIid) {
      throw new Error("CI_MERGE_REQUEST_IID is required in GitLab mode");
    }

    const mrData = await fetchGitLabMRData(token, context);

    const promptDir = `${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts`;
    if (!existsSync(promptDir)) {
      mkdirSync(promptDir, { recursive: true });
    }

    const promptPath = `${promptDir}/claude-prompt.txt`;

    const basePrompt = `You are Claude, an AI assistant helping with GitLab merge requests.

## Merge Request Context

**Title:** ${mrData.title}
**Description:** ${mrData.description || "No description provided"}
**Source Branch:** ${mrData.sourceBranch} → **Target Branch:** ${mrData.targetBranch}
**State:** ${mrData.state}
**Project:** ${context.projectId} on ${context.host}

## Code Changes

${mrData.changes
      .map(
        (change) => `### ${
          change.new_file
            ? "📄 New File"
            : change.deleted_file
              ? "🗑️ Deleted File"
              : change.renamed_file
                ? "📝 Renamed File"
                : "✏️ Modified File"
        }: \`${change.new_path}\`

\`\`\`diff
${change.diff}
\`\`\``,
      )
      .join("\n")}

## Existing Comments/Discussions

${
      mrData.discussions.length > 0
        ? mrData.discussions
            .map((discussion) =>
              discussion.notes
                .map(
                  (note) => `**${note.author.name}** (${note.created_at}):
${note.body}
`,
                )
                .join("\n"),
            )
            .join("\n---\n")
        : "No existing comments"
    }

## Your Task

${
      directPrompt ||
      "Please analyze this merge request and provide feedback on code quality, potential issues, and suggestions for improvement."
    }

## Response Format

Please structure your response in this EXACT format:

### Inline Comments
For specific issues/suggestions, use this format:
\`\`\`
FILE: path/to/file.js LINE: 42 - [ISSUE] Description of the issue here
FILE: another/file.py LINE: 15 - [SUGGESTION] Suggestion for improvement
FILE: src/app.ts LINE: 23 - [CRITICAL] Critical security issue found
\`\`\`

Use these severity levels:
- **[CRITICAL]** - Security issues, bugs that could cause failures
- **[ISSUE]** - Code problems, bad practices, potential bugs  
- **[SUGGESTION]** - Improvements, optimizations, style suggestions

### Overall Summary
Provide a general assessment covering:
- Overall code quality
- Architecture/design feedback
- Testing recommendations
- Performance considerations
- Security assessment

Be specific and reference exact line numbers and file paths when providing feedback.`;

    writeFileSync(promptPath, basePrompt);

    core.setOutput("mcp_config", "");

    console.log(`✅ Prompt written to ${promptPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Prepare step failed with error: ${errorMessage}`);
    core.setOutput("prepare_error", errorMessage);
    process.exit(1);
  }
}

if (import.meta.main) {
  const providerEnv = process.env.CI_PLATFORM ?? "github";

  if (providerEnv === "gitlab") {
    const { context } = getProvider({ provider: "gitlab" });
    runGitLabFlow(context as ParsedGitLabContext);
  } else {
    runGitHubFlow();
  }
}
