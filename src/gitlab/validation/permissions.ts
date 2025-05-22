#!/usr/bin/env bun

// Use the global fetch API so tests can easily mock network requests

/**
 * Check if a user has write access to a GitLab project.
 * Returns true when the member's access level is Developer (30) or higher.
 */
export async function checkWritePermissions(
  token: string,
  host: string,
  projectId: string,
  username: string,
): Promise<boolean> {
  const url = `${host}/api/v4/projects/${encodeURIComponent(projectId)}/members/all?query=${encodeURIComponent(username)}`;
  try {
    const res = await fetch(url, { headers: { "PRIVATE-TOKEN": token } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab API error ${res.status}: ${text}`);
    }
    const members = (await res.json()) as Array<{ username: string; access_level: number }>;
    const member = members.find((m) => m.username === username);
    const level = member?.access_level ?? 0;
    console.log(`Access level retrieved: ${level}`);
    if (level >= 30) {
      console.log(`Actor has write access: ${level}`);
      return true;
    }
    console.warn(`Actor has insufficient permissions: ${level}`);
    return false;
  } catch (error) {
    console.error(`Failed to check permissions: ${error}`);
    throw new Error(`Failed to check permissions for ${username}: ${error}`);
  }
}
