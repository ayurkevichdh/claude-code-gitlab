import { $ } from "bun";
import type { Octokits } from "../github/api/client";
import type { ParsedGitHubContext } from "../github/context";
import { IProvider } from "./IProvider";

export class GitHubProvider implements IProvider {
  constructor(
    private octokits: Octokits,
    private context: ParsedGitHubContext,
  ) {}

  async getDiff(
    base: string,
    head: string,
    filePath?: string,
  ): Promise<string> {
    const args = [base, head];
    if (filePath) {
      args.push("--", filePath);
    }
    const { stdout } = await $`git diff ${args}`.quiet();
    return stdout.toString();
  }

  async createProgressComment(body: string): Promise<number> {
    const { owner, repo } = this.context.repository;
    const res = await this.octokits.rest.issues.createComment({
      owner,
      repo,
      issue_number: this.context.entityNumber,
      body,
    });
    return res.data.id;
  }

  async updateComment(commentId: number, body: string): Promise<void> {
    const { owner, repo } = this.context.repository;
    await this.octokits.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body,
    });
  }

  async addInlineComment(
    filePath: string,
    line: number,
    body: string,
  ): Promise<number> {
    const { owner, repo } = this.context.repository;
    const pr = await this.octokits.rest.pulls.get({
      owner,
      repo,
      pull_number: this.context.entityNumber,
    });
    const res = await this.octokits.rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number: this.context.entityNumber,
      commit_id: pr.data.head.sha,
      body,
      path: filePath,
      line,
    });
    return res.data.id;
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
