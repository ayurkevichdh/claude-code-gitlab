import { $ } from "bun";
import type { GitLabClient } from "./api/client";
import { IProvider } from "../IProvider";

export class GitLabProvider implements IProvider {
  constructor(
    private client: GitLabClient,
    private projectId: string | number,
    private mergeRequestIid: number,
    private headSha: string,
  ) {}

  async getDiff(): Promise<string> {
    const res: any = await this.client.MergeRequests.changes(
      this.projectId,
      this.mergeRequestIid,
    );
    const diffs = res.changes.map((c: any) => c.diff).join("\n");
    return diffs;
  }

  async createProgressComment(body: string): Promise<number> {
    const discussion: any = await this.client.MergeRequestDiscussions.create(
      this.projectId,
      this.mergeRequestIid,
      body,
    );
    const note = discussion.notes[0];
    return note.id;
  }

  async updateComment(commentId: number, body: string): Promise<void> {
    const note: any = await this.client.MergeRequestNotes.show(
      this.projectId,
      this.mergeRequestIid,
      commentId,
    );
    await this.client.MergeRequestDiscussions.editNote(
      this.projectId,
      this.mergeRequestIid,
      note.discussion_id,
      commentId,
      body,
    );
  }

  async addInlineComment(
    filePath: string,
    line: number,
    body: string,
  ): Promise<number> {
    const discussion: any = await this.client.MergeRequestDiscussions.create(
      this.projectId,
      this.mergeRequestIid,
      body,
      {
        position: {
          position_type: "text",
          new_path: filePath,
          new_line: line,
          head_sha: this.headSha,
        },
      },
    );
    const note = discussion.notes[0];
    return note.id;
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
