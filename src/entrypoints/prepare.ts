#!/usr/bin/env bun

/**
 * Prepare the Claude action by checking trigger conditions, verifying human actor,
 * and creating the initial tracking comment
 */

import * as core from "@actions/core";
import { appendFileSync } from "fs";
import { setupGitHubToken } from "../github/token";
import { checkTriggerAction } from "../github/validation/trigger";
import { checkTriggerAction as checkGitLabTriggerAction } from "../gitlab/validation/trigger";
import { checkHumanActor } from "../github/validation/actor";
import { checkWritePermissions } from "../github/validation/permissions";
import {
  createJobRunLink,
  createCommentBody,
} from "../github/operations/comments/common";
import { setupBranch } from "../github/operations/branch";
import { updateTrackingComment } from "../github/operations/comments/update-with-branch";
import { prepareMcpConfig } from "../mcp/install-mcp-server";
import { createPrompt } from "../create-prompt";
import { createOctokit, type Octokits } from "../github/api/client";
import { fetchGitHubData } from "../github/data/fetcher";
import type { ParsedGitHubContext } from "../github/context";
import type { ParsedGitLabContext } from "../gitlab/context";
import { getProvider } from "../providers/provider-factory";
import type { IProvider } from "../providers/IProvider";

export async function run(
  provider: IProvider,
  context: ParsedGitHubContext | ParsedGitLabContext,
  octokit?: Octokits,
) {
  try {
    const isGitLab = "projectId" in context;
    
    if (isGitLab) {
      // GitLab flow
      const gitlabContext = context as ParsedGitLabContext;
      
      // Step 4: Check trigger conditions for GitLab
      const triggerPhrase = process.env.TRIGGER_PHRASE || "@claude";
      const directPrompt = process.env.DIRECT_PROMPT || "";
      
      // Parse GitLab webhook payload
      const gitlabPayload = process.env.GITLAB_WEBHOOK_PAYLOAD ? 
        JSON.parse(process.env.GITLAB_WEBHOOK_PAYLOAD) : 
        { object_kind: "merge_request", object_attributes: {} };
      
      const containsTrigger = await checkGitLabTriggerAction({
        payload: gitlabPayload,
        inputs: { triggerPhrase, directPrompt }
      });

      if (!containsTrigger) {
        console.log("No trigger found, skipping remaining steps");
        return;
      }
    } else {
      // GitHub flow
      // Step 1: Setup GitHub token
      const githubToken = await setupGitHubToken();
      const octokitClient = octokit ?? createOctokit(githubToken);

      // Step 3: Check write permissions
      const hasWritePermissions = await checkWritePermissions(
        octokitClient.rest,
        context,
      );
      if (!hasWritePermissions) {
        throw new Error(
          "Actor does not have write permissions to the repository",
        );
      }

      // Step 4: Check trigger conditions
      const containsTrigger = await checkTriggerAction(context as ParsedGitHubContext);

      if (!containsTrigger) {
        console.log("No trigger found, skipping remaining steps");
        return;
      }

      // Step 5: Check if actor is human
      await checkHumanActor(octokitClient.rest, context as ParsedGitHubContext);
    }

    // Step 6: Create initial tracking comment
    let commentId: number;
    let jobRunLink: string;
    
    if (isGitLab) {
      // For GitLab, create a simple progress comment
      jobRunLink = process.env.CI_PIPELINE_URL || "GitLab CI Pipeline";
      const initialBody = `🤖 Claude is working on this...

[View job details](${jobRunLink})

---
- [ ] Setting up workspace
- [ ] Analyzing request
- [ ] Implementing changes
- [ ] Running tests`;
      commentId = await provider.createProgressComment(initialBody);
    } else {
      const githubContext = context as ParsedGitHubContext;
      jobRunLink = createJobRunLink(
        githubContext.repository.owner,
        githubContext.repository.repo,
        githubContext.runId,
      );
      const initialBody = createCommentBody(jobRunLink);
      commentId = await provider.createProgressComment(initialBody);
    }
    
    const githubOutput = process.env.GITHUB_OUTPUT;
    if (githubOutput) {
      appendFileSync(githubOutput, `claude_comment_id=${commentId}\n`);
    }
    
    // Also set as environment variable for GitLab
    process.env.CLAUDE_COMMENT_ID = commentId.toString();
    console.log(`Comment ID: ${commentId}`);
    
    // Output for GitLab CI to capture
    if (isGitLab) {
      console.log(`CLAUDE_COMMENT_ID=${commentId}`);
    }

    if (!isGitLab) {
      // GitHub-specific steps
      const githubContext = context as ParsedGitHubContext;
      const githubToken = await setupGitHubToken();
      const octokitClient = octokit ?? createOctokit(githubToken);
      
      // Step 7: Fetch GitHub data (once for both branch setup and prompt creation)
      const githubData = await fetchGitHubData({
        octokits: octokitClient,
        repository: `${githubContext.repository.owner}/${githubContext.repository.repo}`,
        prNumber: githubContext.entityNumber.toString(),
        isPR: githubContext.isPR,
      });

      // Step 8: Setup branch
      const branchInfo = await setupBranch(octokitClient, githubData, githubContext);

      // Step 9: Update initial comment with branch link (only for issues that created a new branch)
      if (branchInfo.claudeBranch) {
        await updateTrackingComment(
          octokitClient,
          githubContext,
          commentId,
          branchInfo.claudeBranch,
        );
      }

      // Step 10: Create prompt file
      await createPrompt(
        commentId,
        branchInfo.defaultBranch,
        branchInfo.claudeBranch,
        githubData,
        githubContext,
      );

      // Step 11: Get MCP configuration
      const mcpConfig = await prepareMcpConfig(
        githubToken,
        githubContext.repository.owner,
        githubContext.repository.repo,
        branchInfo.currentBranch,
      );
      core.setOutput("mcp_config", mcpConfig);
    } else {
      // GitLab-specific steps - simplified for now
      // TODO: Implement GitLab data fetching and prompt creation
      console.log("GitLab mode - simplified prompt creation");
      
      // For now, create a basic prompt file
      const fs = require("fs");
      const path = require("path");
      const promptDir = "/tmp/claude-prompts";
      if (!fs.existsSync(promptDir)) {
        fs.mkdirSync(promptDir, { recursive: true });
      }
      
      const basicPrompt = `You are Claude, an AI assistant helping with GitLab merge requests.

Project ID: ${(context as ParsedGitLabContext).projectId}
MR IID: ${(context as ParsedGitLabContext).mrIid || "N/A"}
Host: ${(context as ParsedGitLabContext).host}

Please analyze the current merge request and help with any requested changes.`;
      
      fs.writeFileSync(path.join(promptDir, "claude-prompt.txt"), basicPrompt);
      
      // Set empty MCP config for GitLab
      core.setOutput("mcp_config", "");
    }
  } catch (error) {
    core.setFailed(`Prepare step failed with error: ${error}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  const { provider, context, octokits } = getProvider();
  run(provider, context, octokits);
}
