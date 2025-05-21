import { $ } from "bun";
import fetch from "node-fetch";
import { IProvider } from "./IProvider";
import type { ParsedGitLabContext } from "../gitlab/context";

export class GitLabProvider implements IProvider {
  constructor(
    private token: string,
    private context: ParsedGitLabContext,
  ) {}

  private async request(path: string, options: fetch.RequestInit = {}) {
    const url = `${this.context.host}/api/v4${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<any>;
  }

  async getDiff(
    base: string,
    head: string,
    filePath?: string,
  ): Promise<string> {
    const args = [base, head];
    if (filePath) args.push("--", filePath);
    const { stdout } = await $`git diff ${args}`.quiet();
    return stdout.toString();
  }

  async createProgressComment(body: string): Promise<number> {
    if (!this.context.mrIid) throw new Error("mrIid required");
    const data = await this.request(
      `/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mrIid}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
    );
    return data.id as number;
  }

  async updateComment(commentId: number, body: string): Promise<void> {
    if (!this.context.mrIid) throw new Error("mrIid required");
    await this.request(
      `/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mrIid}/notes/${commentId}`,
      {
        method: "PUT",
        body: JSON.stringify({ body }),
      },
    );
  }

  async addInlineComment(
    filePath: string,
    line: number,
    body: string,
  ): Promise<number> {
    if (!this.context.mrIid) throw new Error("mrIid required");
    const { stdout } = await $`git rev-parse HEAD`.quiet();
    const headSha = stdout.toString().trim();
    const data = await this.request(
      `/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mrIid}/discussions`,
      {
        method: "POST",
        body: JSON.stringify({
          body,
          position: {
            position_type: "text",
            new_path: filePath,
            new_line: line,
            head_sha: headSha,
          },
        }),
      },
    );
    return data.notes?.[0]?.id ?? data.id;
  }

  async pushFixupCommit(message: string): Promise<string> {
    await $`git add -A`.quiet();
    await $`git commit -m ${message}`.quiet();
    const { stdout } = await $`git rev-parse HEAD`.quiet();
    const sha = stdout.toString().trim();
    await $`git push`.quiet();
    return sha;
  }
}
