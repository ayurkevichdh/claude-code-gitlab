import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { checkHumanActor } from "../src/gitlab/validation/actor";
import { checkWritePermissions } from "../src/gitlab/validation/permissions";

const token = "tok";
const host = "https://gitlab.com";

describe("GitLab actor validation", () => {
  let fetchSpy: any;
  beforeEach(() => {
    fetchSpy = spyOn(global, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("throws for non-user actor", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => [{ user_type: "alert_bot" }],
    } as any);

    await expect(
      checkHumanActor(token, host, "bot"),
    ).rejects.toThrow(
      "Workflow initiated by non-human actor: bot (type: alert_bot).",
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${host}/api/v4/users?username=bot`,
      { headers: { "PRIVATE-TOKEN": token } },
    );
  });

  test("passes for user actor", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => [{ user_type: "user" }],
    } as any);

    await checkHumanActor(token, host, "alice");
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe("GitLab permissions validation", () => {
  let fetchSpy: any;
  let logSpy: any;
  let warnSpy: any;
  let errSpy: any;
  beforeEach(() => {
    fetchSpy = spyOn(global, "fetch");
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    errSpy = spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  test("returns true for developer access", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => [{ username: "alice", access_level: 40 }],
    } as any);

    const result = await checkWritePermissions(token, host, "1", "alice");
    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${host}/api/v4/projects/1/members/all?query=alice`,
      { headers: { "PRIVATE-TOKEN": token } },
    );
  });

  test("returns false for guest access", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => [{ username: "alice", access_level: 10 }],
    } as any);

    const result = await checkWritePermissions(token, host, "1", "alice");
    expect(result).toBe(false);
  });

  test("throws when API request fails", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "nope",
    } as any);

    await expect(
      checkWritePermissions(token, host, "1", "alice"),
    ).rejects.toThrow("GitLab API error 403: nope");
    expect(errSpy).toHaveBeenCalled();
  });
});
