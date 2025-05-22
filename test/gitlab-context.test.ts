import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { parseGitLabContext } from "../src/gitlab/context";

describe("parseGitLabContext", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses environment variables as defaults", () => {
    process.env.CI_PROJECT_ID = "123";
    process.env.CI_MERGE_REQUEST_IID = "456";
    process.env.CI_SERVER_URL = "https://gitlab.example.com";

    const ctx = parseGitLabContext();

    expect(ctx).toEqual({
      projectId: "123",
      mrIid: "456",
      host: "https://gitlab.example.com",
    });
  });

  it("returns undefined for mrIid when not provided", () => {
    process.env.CI_PROJECT_ID = "123";
    const ctx = parseGitLabContext();

    expect(ctx.projectId).toBe("123");
    expect(ctx.mrIid).toBeUndefined();
    expect(ctx.host).toBe("https://gitlab.com");
  });

  it("throws when CI_PROJECT_ID is missing", () => {
    expect(() => parseGitLabContext()).toThrow(
      "GitLab project ID is required",
    );
  });
});
