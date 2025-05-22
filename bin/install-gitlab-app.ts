#!/usr/bin/env bun
import { createInterface } from "readline/promises";
import { Gitlab } from "@gitbeaker/rest";
import { upsertVariables, ensureCiFile } from "../src/gitlab/install";

function parseArgs(args: string[]) {
  const opts: any = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--gitlab-host":
      case "--host":
        opts.host = args[++i];
        break;
      case "--token":
      case "--gitlab-token":
        opts.token = args[++i];
        break;
      case "--project-id":
        opts.projectId = args[++i];
        break;
      case "--anthropic-key":
        opts.anthropicKey = args[++i];
        break;
    }
  }
  return opts;
}

async function promptMissing(opts: any) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (!opts.host) {
    opts.host =
      (await rl.question("GitLab host URL (default https://gitlab.com): ")) ||
      "https://gitlab.com";
  }
  if (!opts.token) {
    opts.token = await rl.question("Personal access token (scope api): ");
  }
  if (!opts.projectId) {
    opts.projectId = await rl.question("Project ID: ");
  }
  if (!opts.anthropicKey) {
    opts.anthropicKey = await rl.question("Anthropic API key: ");
  }
  rl.close();
}

async function run() {
  const opts = parseArgs(Bun.argv.slice(2));
  await promptMissing(opts);

  const api = new Gitlab({ host: opts.host, token: opts.token });
  await upsertVariables(api, opts.projectId, opts.token, opts.anthropicKey);
  await ensureCiFile(api, opts.projectId);

  console.log(
    "\nSetup complete! Add '/claude' to a merge request comment to activate Claude.",
  );
}

if (import.meta.main) {
  run().catch((err) => {
    console.error("Installation failed:", err);
    process.exit(1);
  });
}
