import { Gitlab } from "@gitbeaker/rest";
import { GITLAB_API_URL } from "./config";

export type GitLabClient = InstanceType<typeof Gitlab>;

export function createGitLabClient(token: string): GitLabClient {
  return new Gitlab({ host: GITLAB_API_URL, token });
}
