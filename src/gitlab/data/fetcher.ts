#!/usr/bin/env bun

/**
 * Fetch GitLab merge request data for Claude analysis
 */

import type { ParsedGitLabContext } from "../context";

export type GitLabMRData = {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  state: string;
  changes: Array<{
    old_path: string;
    new_path: string;
    new_file: boolean;
    renamed_file: boolean;
    deleted_file: boolean;
    diff: string;
  }>;
  discussions: Array<{
    notes: Array<{
      body: string;
      author: { name: string };
      created_at: string;
    }>;
  }>;
};

export async function fetchGitLabMRData(
  token: string,
  context: ParsedGitLabContext
): Promise<GitLabMRData> {
  const baseUrl = `${context.host}/api/v4`;
  const headers = {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
  };
  
  if (!context.mrIid) {
    throw new Error("MR IID is required to fetch MR data");
  }
  
  try {
    // Fetch MR basic info
    const mrResponse = await fetch(
      `${baseUrl}/projects/${encodeURIComponent(context.projectId)}/merge_requests/${context.mrIid}`,
      { headers }
    );
    
    if (!mrResponse.ok) {
      throw new Error(`Failed to fetch MR: ${mrResponse.status}`);
    }
    
    const mrData = await mrResponse.json();
    
    // Fetch MR changes/diff
    const changesResponse = await fetch(
      `${baseUrl}/projects/${encodeURIComponent(context.projectId)}/merge_requests/${context.mrIid}/changes`,
      { headers }
    );
    
    if (!changesResponse.ok) {
      throw new Error(`Failed to fetch MR changes: ${changesResponse.status}`);
    }
    
    const changesData = await changesResponse.json();
    
    // Fetch discussions (comments)
    const discussionsResponse = await fetch(
      `${baseUrl}/projects/${encodeURIComponent(context.projectId)}/merge_requests/${context.mrIid}/discussions`,
      { headers }
    );
    
    let discussions = [];
    if (discussionsResponse.ok) {
      discussions = await discussionsResponse.json();
    }
    
    return {
      title: mrData.title || "",
      description: mrData.description || "",
      sourceBranch: mrData.source_branch || "",
      targetBranch: mrData.target_branch || "",
      state: mrData.state || "",
      changes: changesData.changes || [],
      discussions: discussions || [],
    };
    
  } catch (error) {
    console.error("Error fetching GitLab MR data:", error);
    throw error;
  }
}