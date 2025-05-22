import { readFile } from "fs/promises";
import { resolve } from "path";
import { Gitlab } from "@gitbeaker/rest";

export async function upsertVariables(
  api: Pick<Gitlab, "ProjectVariables">,
  projectId: string | number,
  gitlabToken: string,
  anthropicKey: string,
) {
  async function upsert(key: string, value: string) {
    try {
      await (api as any).ProjectVariables.create(projectId, key, value);
      console.log(`Created variable ${key}`);
    } catch (_) {
      await (api as any).ProjectVariables.edit(projectId, key, value);
      console.log(`Updated variable ${key}`);
    }
  }

  await upsert("GITLAB_TOKEN", gitlabToken);
  await upsert("ANTHROPIC_API_KEY", anthropicKey);
}

export async function ensureCiFile(api: Gitlab, projectId: string | number) {
  const project = await api.Projects.show(projectId as any);
  const branch = project.default_branch as string;
  const filePath = ".gitlab-ci.yml";
  try {
    await api.RepositoryFiles.show(projectId as any, filePath, branch);
    console.log(`${filePath} already exists`);
  } catch (_) {
    const content = await readFile(resolve("examples/gitlab-ci.yml"), "utf8");
    await api.RepositoryFiles.create(
      projectId as any,
      filePath,
      branch,
      content,
      "Add Claude CI",
    );
    console.log(`Committed ${filePath} to ${branch}`);
  }
}
