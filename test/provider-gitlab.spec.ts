import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as nodeFetch from "node-fetch";
import { GitLabProvider } from "../src/providers/gitlab";

const context = { projectId: "123", mergeRequestIid: 10 };

describe("GitLabProvider", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = spyOn(nodeFetch, "default").mockResolvedValue({
      json: async () => ({ id: 99, notes: [{ id: 88 }] }),
    } as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("creates progress comment", async () => {
    const provider = new GitLabProvider("TOKEN", context);
    const id = await provider.createProgressComment("Work started");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/123/merge_requests/10/notes",
      {
        method: "POST",
        headers: {
          "PRIVATE-TOKEN": "TOKEN",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: "Work started" }),
      },
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body).toMatchSnapshot();
    expect(id).toBe(99);
  });

  it("retrieves diff between refs", async () => {
    const provider = new GitLabProvider("TOKEN", context);
    const diff = await provider.getDiff("HEAD", "HEAD");
    expect(diff).toMatchSnapshot();
  });
});
