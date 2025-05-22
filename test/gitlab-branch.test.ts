import { describe, test, expect, afterEach, jest } from "bun:test";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bun = require("bun");

import type { ParsedGitLabContext } from "../src/gitlab/context";

let fetchSpy: any;
let shellSpy: any;

function mockShell(outputs: string[] = []) {
  const commands: string[] = [];
  let index = 0;
  const original = bun.$;
  const mockFn = (strings: TemplateStringsArray, ...expressions: any[]) => {
    const cmd = strings.reduce((acc, str, i) => {
      const expr = i < expressions.length ? expressions[i] : "";
      const val = Array.isArray(expr) ? expr.join(" ") : String(expr);
      return acc + str + val;
    }, "");
    commands.push(cmd.trim());
    const stdout = outputs[index++] ?? "";
    return { quiet: async () => ({ stdout: Buffer.from(stdout) }) } as any;
  };
  bun.$ = mockFn as any;
  shellSpy = {
    restore: () => {
      bun.$ = original;
    },
  } as any;
  return commands;
}

function restoreSpies() {
  if (fetchSpy) fetchSpy.mockRestore();
  if (shellSpy) shellSpy.restore();
}

describe("gitlab setupBranch", () => {
  const token = "tok";
  const context: ParsedGitLabContext = {
    projectId: "1",
    mrIid: "10",
    host: "https://gitlab.com",
  };

  afterEach(() => {
    restoreSpies();
  });

  test("checks out existing MR branch when open", async () => {
    const commands = mockShell(["", ""]);
    fetchSpy = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ default_branch: "main" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: "opened", source_branch: "feat" }),
      });
    // @ts-expect-error override
    global.fetch = fetchSpy;
    const { setupBranch } = await import(
      `../src/gitlab/operations/branch?${Math.random()}`
    );

    const info = await setupBranch(token, context);

    expect(info).toEqual({ defaultBranch: "main", currentBranch: "feat" });
    expect(commands).toEqual(["git fetch origin feat", "git checkout feat"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/1",
      {
        headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/1/merge_requests/10",
      {
        headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
      },
    );
  });

  test("creates new branch when MR closed", async () => {
    const commands = mockShell(["", ""]);
    fetchSpy = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ default_branch: "main" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: "merged", source_branch: "feat" }),
      })
      .mockResolvedValueOnce({ ok: true });
    // @ts-expect-error override
    global.fetch = fetchSpy;
    const { setupBranch } = await import(
      `../src/gitlab/operations/branch?${Math.random()}`
    );

    const info = await setupBranch(token, context);

    expect(info.currentBranch).toMatch(/^claude\/mr-10-/);
    expect(info.claudeBranch).toBe(info.currentBranch);
    expect(info.defaultBranch).toBe("main");
    expect(commands).toEqual([
      `git fetch origin ${info.currentBranch}`,
      `git checkout ${info.currentBranch}`,
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/1/repository/branches?branch=" +
        encodeURIComponent(info.currentBranch) +
        "&ref=main",
      {
        method: "POST",
        headers: { "PRIVATE-TOKEN": token, "Content-Type": "application/json" },
      },
    );
  });
});
