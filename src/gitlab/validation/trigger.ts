#!/usr/bin/env bun

import * as core from "@actions/core";
import { escapeRegExp } from "../../github/validation/trigger";

export type GitLabMergeRequestEvent = {
  object_kind: "merge_request";
  object_attributes: {
    title?: string;
    description?: string;
  };
};

export type GitLabNoteEvent = {
  object_kind: "note";
  object_attributes: {
    note: string;
    noteable_type: string;
  };
};

export type ParsedGitLabWebhookContext = {
  payload: GitLabMergeRequestEvent | GitLabNoteEvent;
  inputs: {
    triggerPhrase: string;
    directPrompt: string;
  };
};

export function checkContainsTrigger(
  context: ParsedGitLabWebhookContext,
): boolean {
  const {
    inputs: { triggerPhrase, directPrompt },
    payload,
  } = context;

  if (directPrompt) {
    console.log(`Direct prompt provided, triggering action`);
    return true;
  }

  const regex = new RegExp(
    `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
  );

  if (payload.object_kind === "merge_request") {
    const desc = payload.object_attributes.description || "";
    const title = payload.object_attributes.title || "";
    if (regex.test(desc)) {
      console.log(
        `Merge request description contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }
    if (regex.test(title)) {
      console.log(
        `Merge request title contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }
  }

  if (payload.object_kind === "note") {
    const note = payload.object_attributes.note || "";
    if (regex.test(note)) {
      console.log(`Comment contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
  }

  console.log(`No trigger was met for ${triggerPhrase}`);
  return false;
}

export async function checkTriggerAction(context: ParsedGitLabWebhookContext) {
  const containsTrigger = checkContainsTrigger(context);
  core.setOutput("contains_trigger", containsTrigger.toString());
  return containsTrigger;
}
