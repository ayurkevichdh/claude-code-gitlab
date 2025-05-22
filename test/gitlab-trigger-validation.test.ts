import { describe, it, expect } from "bun:test";
import { checkContainsTrigger } from "../src/gitlab/validation/trigger";

const baseInputs = { triggerPhrase: "@claude", directPrompt: "" };

describe("GitLab trigger detection", () => {
  it("detects trigger in merge request description", () => {
    const context = {
      inputs: baseInputs,
      payload: {
        object_kind: "merge_request",
        object_attributes: {
          description: "Please review @claude.",
          title: "Add feature",
        },
      },
    } as const;
    expect(checkContainsTrigger(context)).toBe(true);
  });

  it("detects trigger in merge request title", () => {
    const context = {
      inputs: baseInputs,
      payload: {
        object_kind: "merge_request",
        object_attributes: {
          description: "No trigger here",
          title: "@claude please review",
        },
      },
    } as const;
    expect(checkContainsTrigger(context)).toBe(true);
  });

  it("detects trigger in note comment", () => {
    const context = {
      inputs: baseInputs,
      payload: {
        object_kind: "note",
        object_attributes: {
          note: "Hey @claude, take a look",
          noteable_type: "MergeRequest",
        },
      },
    } as const;
    expect(checkContainsTrigger(context)).toBe(true);
  });

  it("returns false when trigger not present", () => {
    const context = {
      inputs: baseInputs,
      payload: {
        object_kind: "note",
        object_attributes: {
          note: "Just a comment",
          noteable_type: "MergeRequest",
        },
      },
    } as const;
    expect(checkContainsTrigger(context)).toBe(false);
  });
});
