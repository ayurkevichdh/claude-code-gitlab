#!/usr/bin/env bun

/**
 * Prepare the Claude action by checking trigger conditions, verifying human actor,
 * and creating the initial tracking comment
 */

import * as core from "@actions/core";
import { appendFileSync } from "fs";
import { setupGitHubToken } from "../github/token";
import { checkTriggerAction } from "../github/validation/trigger";
import { checkHumanActor as checkGitHubHumanActor } from "../github/validation/actor";
import { checkWritePermissions as checkGitHubWritePermissions } from "../github/validation/permissions";
import { checkHumanActor as checkGitLabHumanActor } from "../gitlab/validation/actor";
import { checkWritePermissions as checkGitLabWritePermissions } from "../gitlab/validation/permissions";
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
import { GitLabProvider } from "../providers/gitlab";
import { getProvider } from "../providers/provider-factory";
import type { IProvider } from "../providers/IProvider";

export async function run(
  provider: IProvider,
  context: ParsedGitHubContext | ParsedGitLabContext,
  octokit?: Octokits,
) {
  try {
    // Step 1: Setup GitHub token
    const githubToken = await setupGitHubToken();
    const octokitClient = octokit ?? createOctokit(githubToken);

    // Step 3: Check write permissions
    let hasWritePermissions: boolean;
    if (provider instanceof GitLabProvider) {
      const glContext = context as ParsedGitLabContext;
      const actor = process.env.GITLAB_USER_LOGIN ?? "";
      hasWritePermissions = await checkGitLabWritePermissions(
        process.env.GITLAB_TOKEN!,
        glContext.host,
        glContext.projectId,
        actor,
      );
    } else {
      hasWritePermissions = await checkGitHubWritePermissions(
        octokitClient.rest,
        context as ParsedGitHubContext,
      );
    }
    if (!hasWritePermissions) {
      throw new Error(
        "Actor does not have write permissions to the repository",
      );
    }

    // Step 4: Check trigger conditions
    const containsTrigger = await checkTriggerAction(context);

    if (!containsTrigger) {
      console.log("No trigger found, skipping remaining steps");
      return;
    }

    // Step 5: Check if actor is human
    if (provider instanceof GitLabProvider) {
      const glContext = context as ParsedGitLabContext;
      const actor = process.env.GITLAB_USER_LOGIN ?? "";
      await checkGitLabHumanActor(
        process.env.GITLAB_TOKEN!,
        glContext.host,
        actor,
      );
    } else {
      await checkGitHubHumanActor(
        octokitClient.rest,
        context as ParsedGitHubContext,
      );
    }

    // Step 6: Create initial tracking comment
    const jobRunLink = createJobRunLink(
      context.repository.owner,
      context.repository.repo,
      context.runId,
    );
    const initialBody = createCommentBody(jobRunLink);
    const commentId = await provider.createProgressComment(initialBody);
    const githubOutput = process.env.GITHUB_OUTPUT;
    if (githubOutput) {
      appendFileSync(githubOutput, `claude_comment_id=${commentId}\n`);
    }

    // Step 7: Fetch GitHub data (once for both branch setup and prompt creation)
    const githubData = await fetchGitHubData({
      octokits: octokitClient,
      repository: `${context.repository.owner}/${context.repository.repo}`,
      prNumber: context.entityNumber.toString(),
      isPR: context.isPR,
    });

    // Step 8: Setup branch
    const branchInfo = await setupBranch(octokitClient, githubData, context);

    // Step 9: Update initial comment with branch link (only for issues that created a new branch)
    if (branchInfo.claudeBranch) {
      await updateTrackingComment(
        octokitClient,
        context,
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
      context,
    );

    // Step 11: Get MCP configuration
    const mcpConfig = await prepareMcpConfig(
      githubToken,
      context.repository.owner,
      context.repository.repo,
      branchInfo.currentBranch,
    );
    core.setOutput("mcp_config", mcpConfig);
  } catch (error) {
    core.setFailed(`Prepare step failed with error: ${error}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  const { provider, context, octokits } = getProvider();
  run(provider, context as ParsedGitHubContext | ParsedGitLabContext, octokits);
}
