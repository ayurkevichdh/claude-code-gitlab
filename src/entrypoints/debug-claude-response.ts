#!/usr/bin/env bun

/**
 * Debug script to check Claude's actual response format
 */

import { readFileSync, existsSync } from "fs";

function debugClaudeResponse() {
  const outputFile = "claude-output.json";
  
  if (!existsSync(outputFile)) {
    console.log("❌ No claude-output.json found");
    return;
  }
  
  const output = JSON.parse(readFileSync(outputFile, "utf-8"));
  
  console.log("📋 Claude Output Analysis:");
  console.log("=".repeat(80));
  console.log("Success:", output.success);
  console.log("Model:", output.model);
  console.log("Timestamp:", output.timestamp);
  console.log("=".repeat(80));
  console.log("FULL RESPONSE:");
  console.log(output.response);
  console.log("=".repeat(80));
  
  // Test our patterns
  const response = output.response;
  
  console.log("🔍 Testing inline comment patterns:");
  
  // Primary pattern
  const pattern1 = /FILE:\s*([^\s]+)\s+LINE:\s*(\d+)\s*-\s*\[(\w+)\]\s*(.+?)(?=\n(?:FILE:|$|##))/gs;
  const matches1 = [...response.matchAll(pattern1)];
  console.log(`Pattern 1 (FILE: X LINE: Y - [TYPE]): ${matches1.length} matches`);
  
  // Alt pattern 1
  const pattern2 = /FILE:\s*([^\s]+)\s+LINE:\s*(\d+)\s*-\s*(.+?)(?=\n(?:FILE:|$|##))/gs;
  const matches2 = [...response.matchAll(pattern2)];
  console.log(`Pattern 2 (FILE: X LINE: Y -): ${matches2.length} matches`);
  
  // Alt pattern 2
  const pattern3 = /([^\s]+):(\d+)\s*-\s*(.+?)(?=\n(?:[^\s]+:\d+|$|##))/gs;
  const matches3 = [...response.matchAll(pattern3)];
  console.log(`Pattern 3 (file:line -): ${matches3.length} matches`);
  
  // Show what Claude typically writes about files
  const fileRefs = response.match(/\b[\w\-\.\/]+\.[\w]+/g) || [];
  console.log(`📁 File references found: ${fileRefs.slice(0, 10).join(', ')}`);
  
  // Show lines that might be line references
  const lineRefs = response.match(/line\s+\d+/gi) || [];
  console.log(`📍 Line references found: ${lineRefs.slice(0, 10).join(', ')}`);
}

if (import.meta.main) {
  debugClaudeResponse();
}