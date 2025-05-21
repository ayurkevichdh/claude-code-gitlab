import { createOctokit, type Octokits } from "../github/api/client";
import {
  parseGitHubContext,
  type ParsedGitHubContext,
} from "../github/context";
import {
  parseGitLabContext,
  type ParsedGitLabContext,
} from "../gitlab/context";
import { GitHubProvider } from "./github";
import { GitLabProvider } from "./gitlab";
import type { IProvider } from "./IProvider";

export type ProviderType = "github" | "gitlab";

export type ProviderResult = {
  provider: IProvider;
  context: ParsedGitHubContext | ParsedGitLabContext;
  octokits?: Octokits;
};

export function getProvider(
  opts: {
    provider?: ProviderType;
    projectId?: string;
    mrIid?: string;
    gitlabHost?: string;
  } = {},
): ProviderResult {
  const providerName = (opts.provider ??
    process.env.CI_PLATFORM ??
    "github") as ProviderType;

  if (providerName === "gitlab") {
    const token = process.env.GITLAB_TOKEN!;
    const context = parseGitLabContext({
      projectId: opts.projectId,
      mrIid: opts.mrIid,
      host: opts.gitlabHost,
    });
    return { provider: new GitLabProvider(token, context), context };
  }

  const token = process.env.GITHUB_TOKEN!;
  const octokits = createOctokit(token);
  const context = parseGitHubContext();
  return { provider: new GitHubProvider(octokits, context), context, octokits };
}
