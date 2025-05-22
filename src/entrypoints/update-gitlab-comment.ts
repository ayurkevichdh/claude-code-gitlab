#!/usr/bin/env bun

/**
 * Update GitLab MR comment with final results
 */

import { getProvider } from "../providers/provider-factory";
import { readFileSync, existsSync } from "fs";

async function updateGitLabComment() {
  try {
    const { provider } = getProvider();
    
    // Read Claude output
    const outputFile = "claude-output.json";
    if (!existsSync(outputFile)) {
      console.log("⚠️ No Claude output file found");
      return;
    }
    
    const output = JSON.parse(readFileSync(outputFile, "utf-8"));
    const commentId = process.env.CLAUDE_COMMENT_ID;
    
    if (!commentId) {
      console.log("⚠️ No comment ID found - cannot update comment");
      return;
    }
    
    let updatedBody: string;
    
    if (output.success) {
      updatedBody = `🤖 Claude Analysis Complete!

${output.response}

---
✅ **Analysis completed successfully**  
📅 *Completed at ${new Date(output.timestamp).toLocaleString()}*  
🧠 *Model: ${output.model}*  
🔗 [View pipeline](${process.env.CI_PIPELINE_URL})`;
    } else {
      updatedBody = `🤖 Claude Analysis Failed

❌ **Error:** ${output.error}

Please check the [pipeline logs](${process.env.CI_PIPELINE_URL}) for more details.

---
❌ **Analysis failed**  
📅 *Failed at ${new Date(output.timestamp).toLocaleString()}*  
🔗 [View pipeline](${process.env.CI_PIPELINE_URL})`;
    }
    
    await provider.updateComment(parseInt(commentId), updatedBody);
    console.log("✅ Successfully updated GitLab comment");
    
  } catch (error) {
    console.error("❌ Failed to update GitLab comment:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  updateGitLabComment();
}