export interface IProvider {
  /**
   * Return the diff between two git refs. Optionally limit to a single file path.
   */
  getDiff(base: string, head: string, filePath?: string): Promise<string>;

  /**
   * Create a progress comment and return the new comment id.
   */
  createProgressComment(body: string): Promise<number>;

  /**
   * Update an existing comment.
   */
  updateComment(commentId: number, body: string): Promise<void>;

  /**
   * Add an inline comment on a specific file and line. Returns the new comment id.
   */
  addInlineComment(
    filePath: string,
    line: number,
    body: string,
  ): Promise<number>;

  /**
   * Commit staged changes as a fixup commit and push to the remote. Returns the commit SHA.
   */
  pushFixupCommit(message: string): Promise<string>;
}
