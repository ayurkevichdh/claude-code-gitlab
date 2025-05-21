#!/usr/bin/env bun
import { getProvider } from "../src/providers/provider-factory";
import { run as prepare } from "../src/entrypoints/prepare";
import { run as updateCommentLink } from "../src/entrypoints/update-comment-link";

function parseArgs(args: string[]) {
  const opts: any = { _: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--provider":
        opts.provider = args[++i];
        break;
      case "--project-id":
        opts.projectId = args[++i];
        break;
      case "--mr-iid":
        opts.mrIid = args[++i];
        break;
      case "--gitlab-host":
        opts.gitlabHost = args[++i];
        break;
      default:
        opts._.push(arg);
        break;
    }
    i++;
  }
  return opts;
}

const parsed = parseArgs(Bun.argv.slice(2));
const command = parsed._.shift() ?? "prepare";
const { provider, context, octokits } = getProvider(parsed);

switch (command) {
  case "prepare":
    await prepare(provider as any, context as any, octokits as any);
    break;
  case "update-comment-link":
    await updateCommentLink(provider as any, context as any, octokits as any);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
