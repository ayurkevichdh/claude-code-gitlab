export type GitLabUser = {
  username: string;
};

export type GitLabComment = {
  id: number;
  body: string;
  author: GitLabUser;
  created_at: string;
};

export type GitLabFile = {
  path: string;
  additions: number;
  deletions: number;
  changeType: string;
};

export type GitLabMergeRequest = {
  title: string;
  description: string;
  author: GitLabUser;
  source_branch: string;
  target_branch: string;
  sha: string;
  created_at: string;
  state: string;
  additions: number;
  deletions: number;
};

export type GitLabFileWithSHA = GitLabFile & { sha: string };

export type FetchGitLabDataResult = {
  contextData: GitLabMergeRequest;
  comments: GitLabComment[];
  changedFiles: GitLabFile[];
  changedFilesWithSHA: GitLabFileWithSHA[];
  reviewData: null;
  imageUrlMap: Map<string, string>;
};

async function request(
  token: string,
  host: string,
  path: string,
): Promise<any> {
  const url = `${host}/api/v4${path}`;
  const res = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchGitLabData(params: {
  token: string;
  projectId: string;
  mrIid: string;
  host: string;
}): Promise<FetchGitLabDataResult> {
  const { token, projectId, mrIid, host } = params;
  const project = encodeURIComponent(projectId);

  const mr = await request(
    token,
    host,
    `/projects/${project}/merge_requests/${mrIid}`,
  );

  const notes: any[] = await request(
    token,
    host,
    `/projects/${project}/merge_requests/${mrIid}/notes`,
  );

  const changes = await request(
    token,
    host,
    `/projects/${project}/merge_requests/${mrIid}/changes`,
  );

  const contextData: GitLabMergeRequest = {
    title: mr.title,
    description: mr.description || "",
    author: { username: mr.author?.username || "" },
    source_branch: mr.source_branch,
    target_branch: mr.target_branch,
    sha: mr.sha || "",
    created_at: mr.created_at,
    state: mr.state,
    additions: mr.additions || 0,
    deletions: mr.deletions || 0,
  };

  const comments: GitLabComment[] = notes.map((n) => ({
    id: n.id,
    body: n.body,
    author: { username: n.author?.username || "" },
    created_at: n.created_at,
  }));

  const changedFiles: GitLabFile[] = (changes.changes || []).map((c: any) => ({
    path: c.new_path,
    additions: 0,
    deletions: 0,
    changeType: c.new_file
      ? "ADDED"
      : c.deleted_file
        ? "DELETED"
        : c.renamed_file
          ? "RENAMED"
          : "MODIFIED",
  }));

  const changedFilesWithSHA: GitLabFileWithSHA[] = changedFiles.map((file) => {
    try {
      const sha = Bun.spawnSync(["git", "hash-object", file.path])
        .stdout.toString()
        .trim();
      return { ...file, sha };
    } catch {
      return { ...file, sha: "unknown" };
    }
  });

  return {
    contextData,
    comments,
    changedFiles,
    changedFilesWithSHA,
    reviewData: null,
    imageUrlMap: new Map<string, string>(),
  };
}
