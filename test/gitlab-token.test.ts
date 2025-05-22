import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as core from "@actions/core";
import { maskToken, setupGitLabToken } from "../src/providers/gitlab/token";

describe("maskToken", () => {
  test("masks all but last four characters", () => {
    expect(maskToken("abcdef1234")).toBe("******1234");
  });

  test("returns **** when token is short", () => {
    expect(maskToken("1234")).toBe("****");
    expect(maskToken("abc")).toBe("****");
  });
});

describe("setupGitLabToken", () => {
  let originalEnv: typeof process.env;
  let originalArgv: string[];
  let setOutputSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];
    process.env = {};
    process.argv = [originalArgv[0], originalArgv[1]];
    setOutputSpy = spyOn(core, "setOutput").mockImplementation(() => {});
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    setOutputSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  test("reads token and host from environment", () => {
    process.env.GITLAB_TOKEN = "envtoken123";
    process.env.GITLAB_HOST = "https://gitlab.example.com";

    const result = setupGitLabToken();

    expect(result).toEqual({
      token: "envtoken123",
      host: "https://gitlab.example.com",
    });
    expect(setOutputSpy).toHaveBeenCalledWith("GITLAB_TOKEN", "envtoken123");
    expect(setOutputSpy).toHaveBeenCalledWith(
      "GITLAB_HOST",
      "https://gitlab.example.com",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Using GitLab token: ${maskToken("envtoken123")}`,
    );
  });

  test("CLI arguments override environment variables", () => {
    process.env.GITLAB_TOKEN = "envtoken";
    process.env.GITLAB_HOST = "https://env.gitlab.com";
    process.argv.push(
      "--gitlab-token",
      "clitoken",
      "--gitlab-host",
      "https://cli.gitlab.com",
    );

    const result = setupGitLabToken();

    expect(result).toEqual({
      token: "clitoken",
      host: "https://cli.gitlab.com",
    });
  });

  test("defaults host when not provided and throws if token missing", () => {
    expect(() => setupGitLabToken()).toThrow("GitLab token not provided");

    process.env.GITLAB_TOKEN = "abc123";
    const { host } = setupGitLabToken();
    expect(host).toBe("https://gitlab.com");
  });
});
