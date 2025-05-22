#!/usr/bin/env bun

// Use the global fetch API so tests can easily mock network requests

/**
 * Verify that the GitLab actor is a human user using the Users API.
 * Throws an error if the user_type is not "user".
 */
export async function checkHumanActor(
  token: string,
  host: string,
  username: string,
) {
  const url = `${host}/api/v4/users?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: { "PRIVATE-TOKEN": token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch GitLab user ${username}: ${res.status} ${text}`);
  }
  const users = (await res.json()) as Array<{ user_type?: string }>;
  const user = users[0];
  const userType = user?.user_type;
  console.log(`Actor user_type: ${userType}`);
  if (userType !== "user") {
    throw new Error(
      `Workflow initiated by non-human actor: ${username} (type: ${userType}).`,
    );
  }
  console.log(`Verified human actor: ${username}`);
}
