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

  private async getMRDiffData() {
    if (!this.context.mrIid) throw new Error("mrIid required");
    
    // Get MR details and changes
    const [mrData, changesData] = await Promise.all([
      this.request(`/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mrIid}`),
      this.request(`/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mrIid}/changes`)
    ]);
    
    return { mrData, changesData };
  }
  
  private findLineInDiff(filePath: string, lineNumber: number, diffData: any): { old_line: number | null, new_line: number | null } | null {
    // Find the file change in the diff data
    const fileChange = diffData.changes?.find((change: any) => 
      change.new_path === filePath || change.old_path === filePath
    );
    
    if (!fileChange || !fileChange.diff) {
      console.warn(`No diff found for file: ${filePath}`);
      return null;
    }
    
    // Parse the diff to find line mappings
    const diffLines = fileChange.diff.split('\n');
    let oldLineNum = 0;
    let newLineNum = 0;
    
    for (const diffLine of diffLines) {
      if (diffLine.startsWith('@@')) {
        // Parse hunk header like @@ -1,4 +1,6 @@
        const match = diffLine.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1]) - 1;
          newLineNum = parseInt(match[2]) - 1;
        }
        continue;
      }
      
      if (diffLine.startsWith('-')) {
        oldLineNum++;
        // This is a deleted line
        if (oldLineNum === lineNumber) {
          return { old_line: oldLineNum, new_line: null };
        }
      } else if (diffLine.startsWith('+')) {
        newLineNum++;
        // This is an added line
        if (newLineNum === lineNumber) {
          return { old_line: null, new_line: newLineNum };
        }
      } else if (diffLine.startsWith(' ') || diffLine === '') {
        // Unchanged line
        oldLineNum++;
        newLineNum++;
        if (newLineNum === lineNumber || oldLineNum === lineNumber) {
          return { old_line: oldLineNum, new_line: newLineNum };
        }
      }
    }
    
    // If not found in diff, assume it's a new line
    return { old_line: null, new_line: lineNumber };
  }

  async addInlineComment(
    filePath: string,
    line: number,
    body: string,
  ): Promise<number> {
    if (!this.context.mrIid) throw new Error("mrIid required");
    
    try {
      console.log(`🔍 Adding inline comment to ${filePath}:${line}`);
      
      // Get MR and diff data
      const { mrData, changesData } = await this.getMRDiffData();
      
      if (!mrData.diff_refs) {
        throw new Error("No diff_refs found in MR data");
      }
      
      const { base_sha, start_sha, head_sha } = mrData.diff_refs;
      
      // Find the line position in the diff
      const linePosition = this.findLineInDiff(filePath, line, changesData);
      if (!linePosition) {
        throw new Error(`Line ${line} not found in diff for ${filePath}`);
      }
      
      console.log(`📍 Line position: old=${linePosition.old_line}, new=${linePosition.new_line}`);
      
      // Create position object matching GitLab's requirements
      const position = {
        base_sha,
        start_sha,
        head_sha,
        old_path: filePath,
        new_path: filePath,
        position_type: "text",
        old_line: linePosition.old_line,
        new_line: linePosition.new_line
      };
      
      console.log(`📝 Creating discussion with position:`, position);
      
      const data = await this.request(
        `/projects/${encodeURIComponent(this.context.projectId)}/merge_requests/${this.context.mrIid}/discussions`,
        {
          method: "POST",
          body: JSON.stringify({
            body,
            position: position,
          }),
        },
      );
      
      const commentId = data.notes?.[0]?.id ?? data.id;
      console.log(`✅ Created inline comment ${commentId}`);
      return commentId;
      
    } catch (error) {
      // Fallback: post as regular comment instead of inline comment
      console.warn(`❌ Failed to post inline comment on ${filePath}:${line}:`, error);
      
      const fallbackBody = `**Comment on \`${filePath}\` line ${line}:**

${body}`;
      
      return await this.createProgressComment(fallbackBody);
    }
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
