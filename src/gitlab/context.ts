export type ParsedGitLabContext = {
  projectId: string;
  mrIid?: string;
  host: string;
};

export function parseGitLabContext(
  opts: {
    projectId?: string;
    mrIid?: string;
    host?: string;
  } = {},
): ParsedGitLabContext {
  const projectId = opts.projectId ?? process.env.CI_PROJECT_ID;
  const mrIid = opts.mrIid ?? process.env.CI_MERGE_REQUEST_IID;
  const host = opts.host ?? process.env.CI_SERVER_URL ?? "https://gitlab.com";
  if (!projectId) {
    throw new Error("GitLab project ID is required");
  }
  return { projectId, mrIid, host };
}
