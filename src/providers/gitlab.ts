import { $ } from "bun";
import fetch from "node-fetch";
import type { IProvider } from "./IProvider";

export interface GitLabContext {
  projectId: string;
  mergeRequestIid: number;
}

export class GitLabProvider implements IProvider {
  constructor(
    private token: string,
    private context: GitLabContext,
    private baseUrl = "https://gitlab.com/api/v4",
  ) {}

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
    const url = `${this.baseUrl}/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mergeRequestIid}/notes`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });
    const data = (await res.json()) as { id: number };
    return data.id;
  }

  async updateComment(commentId: number, body: string): Promise<void> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mergeRequestIid}/notes/${commentId}`;
    await fetch(url, {
      method: "PUT",
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });
  }

  async addInlineComment(
    filePath: string,
    line: number,
    body: string,
  ): Promise<number> {
    const url = `${this.baseUrl}/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mergeRequestIid}/discussions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body,
        position: {
          position_type: "text",
          new_path: filePath,
          new_line: line,
        },
      }),
    });
    const data = (await res.json()) as { notes?: { id: number }[] };
    return data.notes?.[0]?.id ?? 0;
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
