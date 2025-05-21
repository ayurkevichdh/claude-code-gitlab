#!/usr/bin/env bun

/**
 * Simple utility for fetching a GitLab token and host configuration.
 * The token can be provided via the GITLAB_TOKEN environment variable or
 * the --gitlab-token CLI flag. The host defaults to https://gitlab.com but
 * can be overridden with the GITLAB_HOST env var or --gitlab-host flag.
 *
 * The resolved values are returned and also exported via console output so
 * that downstream steps can reference them. When logging the token we mask
 * all but the last 4 characters to avoid accidental leaks, similar to the
 * GitHub token setup script.
 */

import * as core from "@actions/core";

function parseArgs(args: string[]): { token?: string; host?: string } {
  const result: { token?: string; host?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--gitlab-token" || arg === "--token") {
      result.token = args[i + 1];
      i++;
    } else if (arg === "--gitlab-host" || arg === "--host") {
      result.host = args[i + 1];
      i++;
    }
  }
  return result;
}

export type GitLabAuth = {
  token: string;
  host: string;
};

export function maskToken(token: string): string {
  if (token.length <= 4) return "****";
  const visible = token.slice(-4);
  return `${"*".repeat(token.length - 4)}${visible}`;
}

export function setupGitLabToken(): GitLabAuth {
  const { token: cliToken, host: cliHost } = parseArgs(process.argv.slice(2));

  const token = cliToken || process.env.GITLAB_TOKEN;
  const host = cliHost || process.env.GITLAB_HOST || "https://gitlab.com";

  if (!token) {
    throw new Error(
      "GitLab token not provided. Set GITLAB_TOKEN or pass --gitlab-token",
    );
  }

  // Mask token in logs
  const masked = maskToken(token);
  console.log(`Using GitLab token: ${masked}`);

  core.setOutput("GITLAB_TOKEN", token);
  core.setOutput("GITLAB_HOST", host);

  return { token, host };
}

if (import.meta.main) {
  try {
    setupGitLabToken();
  } catch (err) {
    core.setFailed(`Failed to setup GitLab token: ${err}`);
    process.exit(1);
  }
}
