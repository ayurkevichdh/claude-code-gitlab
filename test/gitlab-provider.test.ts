import { describe, test, expect, afterEach, jest } from "bun:test";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bun = require("bun");
import type { ParsedGitLabContext } from "../src/gitlab/context";

let fetchSpy: any;
let shellSpy: any;
let GitLabProvider: any;

const token = "test-token";
const context: ParsedGitLabContext = {
  projectId: "1",
  mrIid: "10",
  host: "https://gitlab.com",
};

function mockShell(outputs: string[] = []) {
  const commands: string[] = [];
  let index = 0;
  const original = bun.$;
  const mockFn = (
    strings: TemplateStringsArray,
    ...expressions: any[]
  ) => {
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
  shellSpy = { restore: () => { bun.$ = original; } } as any;
  return commands;
}

function restoreSpies() {
  if (fetchSpy) fetchSpy.mockRestore();
  if (shellSpy) shellSpy.restore();
}

describe("GitLabProvider", () => {
  afterEach(() => {
    restoreSpies();
  });

  test("createProgressComment uses correct endpoint", async () => {
    mockShell();
    ({ GitLabProvider } = await import(`../src/providers/gitlab?${Math.random()}`));
    const provider = new GitLabProvider(token, context);
    fetchSpy = jest.fn().mockResolvedValue({ id: 42 });
    (provider as any).request = async (path: string, options: any) => {
      const url = `${context.host}/api/v4${path}`;
      await fetchSpy(url, options);
      return { id: 42 };
    };

    const id = await provider.createProgressComment("hello");

    expect(id).toBe(42);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${context.host}/api/v4/projects/1/merge_requests/10/notes`,
      {
        method: "POST",
        body: JSON.stringify({ body: "hello" }),
      },
    );
  });

  test("updateComment uses PUT with correct body", async () => {
    mockShell();
    ({ GitLabProvider } = await import(`../src/providers/gitlab?${Math.random()}`));
    const provider = new GitLabProvider(token, context);
    fetchSpy = jest.fn().mockResolvedValue({});
    (provider as any).request = async (path: string, options: any) => {
      const url = `${context.host}/api/v4${path}`;
      await fetchSpy(url, options);
      return {};
    };

    await provider.updateComment(5, "update");

    expect(fetchSpy).toHaveBeenCalledWith(
      `${context.host}/api/v4/projects/1/merge_requests/10/notes/5`,
      {
        method: "PUT",
        body: JSON.stringify({ body: "update" }),
      },
    );
  });

  test("addInlineComment posts with position info", async () => {
    const commands = mockShell(["abc123\n"]);
    ({ GitLabProvider } = await import(`../src/providers/gitlab?${Math.random()}`));
    const provider = new GitLabProvider(token, context);
    fetchSpy = jest.fn().mockResolvedValue({ notes: [{ id: 7 }] });
    (provider as any).request = async (path: string, options: any) => {
      const url = `${context.host}/api/v4${path}`;
      await fetchSpy(url, options);
      return { notes: [{ id: 7 }] };
    };

    const id = await provider.addInlineComment("src/app.ts", 3, "note");

    expect(commands).toEqual(["git rev-parse HEAD"]);
    expect(id).toBe(7);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${context.host}/api/v4/projects/1/merge_requests/10/discussions`,
      {
        method: "POST",
        body: JSON.stringify({
          body: "note",
          position: {
            position_type: "text",
            new_path: "src/app.ts",
            new_line: 3,
            head_sha: "abc123",
          },
        }),
      },
    );
  });

  test("pushFixupCommit runs git commands", async () => {
    const commands = mockShell(["", "", "abc123\n", ""]);
    ({ GitLabProvider } = await import(`../src/providers/gitlab?${Math.random()}`));
    const provider = new GitLabProvider(token, context);
    const sha = await provider.pushFixupCommit("fix msg");

    expect(sha).toBe("abc123");
    expect(commands).toEqual([
      "git add -A",
      "git commit -m fix msg",
      "git rev-parse HEAD",
      "git push",
    ]);
  });

  test("getDiff runs git diff", async () => {
    let commands = mockShell(["diff\n"]);
    ({ GitLabProvider } = await import(`../src/providers/gitlab?${Math.random()}`));
    let provider = new GitLabProvider(token, context);
    const diff = await provider.getDiff("base", "head");
    expect(diff).toBe("diff\n");
    expect(commands).toEqual(["git diff base head"]);

    restoreSpies();
    commands = mockShell(["diff2\n"]);
    ({ GitLabProvider } = await import(`../src/providers/gitlab?${Math.random()}`));
    provider = new GitLabProvider(token, context);
    const diff2 = await provider.getDiff("base", "head", "file.txt");
    expect(diff2).toBe("diff2\n");
    expect(commands).toEqual(["git diff base head -- file.txt"]);
  });
});
