#!/usr/bin/env bun

import { $ } from "bun";
import * as core from "@actions/core";
import type { ParsedGitLabContext } from "../context";

export type BranchInfo = {
  defaultBranch: string;
  claudeBranch?: string;
  currentBranch: string;
};

export async function setupBranch(
  token: string,
  context: ParsedGitLabContext,
): Promise<BranchInfo> {
  const { projectId, mrIid, host } = context;

  const headers = {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };

  const projectRes = await fetch(
    `${host}/api/v4/projects/${encodeURIComponent(projectId)}`,
    { headers },
  );
  if (!projectRes.ok) {
    throw new Error(`Failed to fetch project: ${await projectRes.text()}`);
  }
  const projectData = (await projectRes.json()) as { default_branch: string };
  const defaultBranch = projectData.default_branch;

  if (mrIid) {
    const mrRes = await fetch(
      `${host}/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}`,
      { headers },
    );
    if (!mrRes.ok) {
      throw new Error(`Failed to fetch MR: ${await mrRes.text()}`);
    }
    const mrData = (await mrRes.json()) as {
      state: string;
      source_branch: string;
    };

    if (mrData.state === "opened") {
      const branchName = mrData.source_branch;
      await $`git fetch origin ${branchName}`;
      await $`git checkout ${branchName}`;
      return { defaultBranch, currentBranch: branchName };
    }
    console.log(
      `MR !${mrIid} is ${mrData.state}, creating new branch from default...`,
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\.\d{3}Z/, "")
    .split("T")
    .join("_");
  const newBranch = `claude/mr-${mrIid ?? ""}-${timestamp}`;

  const createRes = await fetch(
    `${host}/api/v4/projects/${encodeURIComponent(projectId)}/repository/branches?branch=${encodeURIComponent(newBranch)}&ref=${encodeURIComponent(defaultBranch)}`,
    { method: "POST", headers },
  );
  if (!createRes.ok) {
    throw new Error(`Failed to create branch: ${await createRes.text()}`);
  }

  await $`git fetch origin ${newBranch}`;
  await $`git checkout ${newBranch}`;

  core.setOutput("CLAUDE_BRANCH", newBranch);
  core.setOutput("DEFAULT_BRANCH", defaultBranch);

  return { defaultBranch, claudeBranch: newBranch, currentBranch: newBranch };
}
