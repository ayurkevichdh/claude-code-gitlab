#!/usr/bin/env bun

/**
 * Fallback script to call Claude API directly when Claude Code CLI is not available
 */

import * as core from "@actions/core";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { getProvider } from "../providers/provider-factory";

async function callClaudeAPI() {
  try {
    const { provider } = getProvider();
    
    // Read the generated prompt
    const promptFile = "/tmp/claude-prompts/claude-prompt.txt";
    if (!existsSync(promptFile)) {
      throw new Error("Prompt file not found");
    }
    
    const prompt = readFileSync(promptFile, "utf-8");
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not provided");
    }
    
    console.log("🤖 Calling Claude API...");
    
    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const claudeResponse = data.content[0]?.text || "No response from Claude";
    
    console.log("✅ Claude API response received");
    
    // Save output
    const output = {
      success: true,
      response: claudeResponse,
      model: process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-20250219",
      timestamp: new Date().toISOString(),
    };
    
    writeFileSync("claude-output.json", JSON.stringify(output, null, 2));
    
    // Update the GitLab MR comment with Claude's response
    const updatedBody = `🤖 Claude Analysis Complete!

${claudeResponse}

---
*Analysis completed at ${new Date().toLocaleString()}*`;
    
    // Try to update the comment
    try {
      const commentId = process.env.CLAUDE_COMMENT_ID;
      console.log("Comment ID from env:", commentId);
      
      if (commentId && !isNaN(parseInt(commentId))) {
        await provider.updateComment(parseInt(commentId), updatedBody);
        console.log("✅ Updated GitLab comment with Claude's response");
      } else {
        // Create new comment if no comment ID
        console.log("⚠️ No valid comment ID, creating new comment");
        await provider.createProgressComment(updatedBody);
        console.log("✅ Created new GitLab comment with Claude's response");
      }
    } catch (updateError) {
      console.error("⚠️ Failed to update GitLab comment:", updateError);
      console.log("📝 Claude's response:", claudeResponse);
    }
    
  } catch (error) {
    console.error("❌ Claude API call failed:", error);
    
    // Save error output
    const errorOutput = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    
    writeFileSync("claude-output.json", JSON.stringify(errorOutput, null, 2));
    
    // Try to update comment with error
    try {
      const { provider } = getProvider();
      const errorBody = `🤖 Claude Analysis Failed

❌ Error: ${error.message}

Please check the pipeline logs for more details.

---
*Failed at ${new Date().toLocaleString()}*`;
      
      const commentId = process.env.CLAUDE_COMMENT_ID;
      if (commentId) {
        await provider.updateComment(parseInt(commentId), errorBody);
      }
    } catch (updateError) {
      console.error("Failed to update comment with error:", updateError);
    }
    
    process.exit(1);
  }
}

if (import.meta.main) {
  callClaudeAPI();
}