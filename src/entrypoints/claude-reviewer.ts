#!/usr/bin/env bun

/**
 * Enhanced Claude reviewer that posts inline comments + summary
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { getProvider } from "../providers/provider-factory";

type ReviewComment = {
  file: string;
  line: number;
  comment: string;
  severity: "suggestion" | "issue" | "critical";
};

type ReviewSummary = {
  inlineComments: ReviewComment[];
  overallSummary: string;
  approval: "approve" | "request_changes" | "comment";
};

async function parseClaudeReview(response: string): Promise<ReviewSummary> {
  // Parse Claude's response to extract inline comments and summary
  const inlineComments: ReviewComment[] = [];
  let overallSummary = "";
  let approval: "approve" | "request_changes" | "comment" = "comment";

  // Look for inline comment patterns like:
  // FILE: src/app.ts LINE: 42 - [ISSUE] Description here
  // FILE: utils.js LINE: 15 - [SUGGESTION] Description here
  
  const inlinePattern = /FILE:\s*([^\s]+)\s+LINE:\s*(\d+)\s*-\s*\[(\w+)\]\s*(.+?)(?=\n(?:FILE:|$|##))/gs;
  let match;
  
  while ((match = inlinePattern.exec(response)) !== null) {
    const [, file, line, severityRaw, comment] = match;
    const severity = severityRaw.toLowerCase() === "critical" ? "critical" 
                   : severityRaw.toLowerCase() === "issue" ? "issue" 
                   : "suggestion";
    
    inlineComments.push({
      file: file.trim(),
      line: parseInt(line),
      comment: comment.trim(),
      severity
    });
  }

  // Extract overall summary (everything after "## Overall Summary" or similar)
  const summaryMatch = response.match(/##\s*(?:Overall\s*)?Summary\s*\n([\s\S]*?)(?:\n##|$)/i);
  if (summaryMatch) {
    overallSummary = summaryMatch[1].trim();
  } else {
    // If no structured summary, use the part without inline comments
    overallSummary = response.replace(inlinePattern, "").trim();
  }

  // Determine approval status based on content
  if (inlineComments.some(c => c.severity === "critical")) {
    approval = "request_changes";
  } else if (inlineComments.length === 0 || inlineComments.every(c => c.severity === "suggestion")) {
    approval = "approve";
  }

  return { inlineComments, overallSummary, approval };
}

async function postReviewComments() {
  try {
    const { provider } = getProvider();
    
    // Read Claude output
    const outputFile = "claude-output.json";
    if (!existsSync(outputFile)) {
      console.log("⚠️ No Claude output file found");
      return;
    }
    
    const output = JSON.parse(readFileSync(outputFile, "utf-8"));
    
    if (!output.success) {
      console.log("❌ Claude analysis failed, skipping review comments");
      return;
    }

    console.log("🔍 Parsing Claude's review for inline comments...");
    const review = await parseClaudeReview(output.response);
    
    // Post inline comments
    const postedComments: number[] = [];
    for (const comment of review.inlineComments) {
      try {
        console.log(`📝 Posting inline comment on ${comment.file}:${comment.line}`);
        const emoji = comment.severity === "critical" ? "🚨" 
                    : comment.severity === "issue" ? "⚠️" 
                    : "💡";
        
        const formattedComment = `${emoji} **${comment.severity.toUpperCase()}**

${comment.comment}

*- Claude AI Code Review*`;

        const commentId = await provider.addInlineComment(
          comment.file,
          comment.line,
          formattedComment
        );
        postedComments.push(commentId);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to post inline comment on ${comment.file}:${comment.line}:`, error);
      }
    }

    // Create summary comment
    const summaryEmoji = review.approval === "approve" ? "✅" 
                        : review.approval === "request_changes" ? "🔄" 
                        : "📝";
    
    const summaryComment = `${summaryEmoji} **Claude Code Review Complete**

## Summary

${review.overallSummary}

## Review Statistics

- **Inline comments posted:** ${postedComments.length}
- **Issues found:** ${review.inlineComments.filter(c => c.severity === "issue" || c.severity === "critical").length}
- **Suggestions:** ${review.inlineComments.filter(c => c.severity === "suggestion").length}
- **Recommendation:** ${review.approval === "approve" ? "✅ Approve" 
                       : review.approval === "request_changes" ? "🔄 Request Changes" 
                       : "📝 Comment Only"}

---
🤖 *Automated review by Claude AI* | 📅 *${new Date().toLocaleString()}* | 🔗 [Pipeline](${process.env.CI_PIPELINE_URL})`;

    // Update the original comment with summary
    const commentId = process.env.CLAUDE_COMMENT_ID;
    if (commentId && !isNaN(parseInt(commentId))) {
      await provider.updateComment(parseInt(commentId), summaryComment);
      console.log("✅ Updated main comment with review summary");
    } else {
      await provider.createProgressComment(summaryComment);
      console.log("✅ Created new comment with review summary");
    }

    // Save detailed results
    const reviewResults = {
      success: true,
      inlineComments: review.inlineComments,
      summary: review.overallSummary,
      approval: review.approval,
      postedComments: postedComments.length,
      timestamp: new Date().toISOString(),
    };
    
    writeFileSync("claude-review-results.json", JSON.stringify(reviewResults, null, 2));
    console.log(`✅ Review complete: ${postedComments.length} inline comments posted`);
    
  } catch (error) {
    console.error("❌ Failed to post review comments:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  postReviewComments();
}