#!/usr/bin/env bun

/**
 * Update progress comment with completed checkboxes
 */

import { getProvider } from "../providers/provider-factory";

type ProgressStep = {
  name: string;
  completed: boolean;
};

async function updateProgress(steps: ProgressStep[]) {
  try {
    const { provider } = getProvider();
    const commentId = process.env.CLAUDE_COMMENT_ID;
    
    if (!commentId || isNaN(parseInt(commentId))) {
      console.log("⚠️ No valid comment ID to update");
      return;
    }
    
    const jobRunLink = process.env.CI_PIPELINE_URL || "GitLab CI Pipeline";
    
    const checkedSteps = steps.map(step => 
      `- [${step.completed ? 'x' : ' '}] ${step.name}`
    ).join('\n');
    
    const updatedBody = `🤖 Claude is working on this...

[View job details](${jobRunLink})

---
${checkedSteps}`;
    
    await provider.updateComment(parseInt(commentId), updatedBody);
    console.log(`✅ Updated progress: ${steps.filter(s => s.completed).length}/${steps.length} steps completed`);
    
  } catch (error) {
    console.error("❌ Failed to update progress:", error);
  }
}

// Export for programmatic use
export { updateProgress };

// CLI usage: bun run update-progress.ts "Setting up workspace" true
if (import.meta.main) {
  const stepName = process.argv[2];
  const completed = process.argv[3] === "true";
  
  if (!stepName) {
    console.error("Usage: bun run update-progress.ts <step_name> <completed>");
    process.exit(1);
  }
  
  // Get current progress or create default steps
  const defaultSteps = [
    { name: "Setting up workspace", completed: false },
    { name: "Analyzing request", completed: false },
    { name: "Implementing changes", completed: false },
    { name: "Running tests", completed: false },
  ];
  
  // Update the specific step
  const steps = defaultSteps.map(step => 
    step.name === stepName ? { ...step, completed } : step
  );
  
  await updateProgress(steps);
}