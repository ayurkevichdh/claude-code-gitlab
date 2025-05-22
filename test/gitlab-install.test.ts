import { describe, test, expect, jest } from "bun:test";
import { upsertVariables } from "../src/gitlab/install";

describe("upsertVariables", () => {
  test("creates variables when they do not exist", async () => {
    const api = {
      ProjectVariables: {
        create: jest.fn().mockResolvedValue({}),
        edit: jest.fn().mockResolvedValue({}),
      },
    } as any;

    await upsertVariables(api, 1, "tok", "key");

    expect(api.ProjectVariables.create).toHaveBeenCalledWith(
      1,
      "GITLAB_TOKEN",
      "tok",
    );
    expect(api.ProjectVariables.create).toHaveBeenCalledWith(
      1,
      "ANTHROPIC_API_KEY",
      "key",
    );
    expect(api.ProjectVariables.edit).not.toHaveBeenCalled();
  });

  test("updates variables if creation fails", async () => {
    const api = {
      ProjectVariables: {
        create: jest.fn().mockRejectedValue(new Error("exists")),
        edit: jest.fn().mockResolvedValue({}),
      },
    } as any;

    await upsertVariables(api, 1, "tok", "key");

    expect(api.ProjectVariables.create).toHaveBeenCalledTimes(2);
    expect(api.ProjectVariables.edit).toHaveBeenCalledTimes(2);
  });
});
