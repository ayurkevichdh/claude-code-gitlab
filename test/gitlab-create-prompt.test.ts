#!/usr/bin/env bun

import { describe, test, expect } from "bun:test";
import { generatePrompt } from "../src/create-prompt";
import type { PreparedContext } from "../src/create-prompt";

const mockGitLabData = {
  contextData: {
    title: "Test MR",
    body: "This is a test MR",
    author: { login: "testuser" },
    state: "opened",
    createdAt: "2023-01-01T00:00:00Z",
    additions: 10,
    deletions: 2,
    baseRefName: "main",
    headRefName: "feature",
    headRefOid: "def456",
    commits: { totalCount: 1, nodes: [] },
    files: { nodes: [] },
    comments: { nodes: [] },
    reviews: { nodes: [] },
  },
  comments: [],
  changedFiles: [],
  changedFilesWithSHA: [],
  reviewData: { nodes: [] },
  imageUrlMap: new Map<string, string>(),
};

describe("generatePrompt with GitLab data", () => {
  test("basic prompt", () => {
    const ctx: PreparedContext = {
      repository: "owner/repo",
      claudeCommentId: "1",
      triggerPhrase: "@claude",
      eventData: {
        eventName: "pull_request",
        eventAction: "opened",
        isPR: true,
        prNumber: "1",
      },
    };

    const prompt = generatePrompt(ctx, mockGitLabData as any);
    expect(prompt).toContain("You are Claude, an AI assistant");
    expect(prompt).toContain("<pr_number>1</pr_number>");
  });
});
