import type {
  GitHubPullRequest,
  GitHubIssue,
  GitHubComment,
  GitHubFile,
  GitHubReview,
} from "../types";
import type { GitHubFileWithSHA } from "./fetcher";

export function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

export function formatContext(
  contextData: GitHubPullRequest | GitHubIssue,
  isPR: boolean,
): string {
  if (isPR) {
    const prData = contextData as GitHubPullRequest;
    return `PR Title: ${prData.title}
PR Author: ${prData.author.login}
PR Branch: ${prData.headRefName} -> ${prData.baseRefName}
PR State: ${prData.state}
PR Additions: ${prData.additions}
PR Deletions: ${prData.deletions}
Total Commits: ${prData.commits.totalCount}
Changed Files: ${prData.files.nodes.length} files`;
  } else {
    const issueData = contextData as GitHubIssue;
    return `Issue Title: ${issueData.title}
Issue Author: ${issueData.author.login}
Issue State: ${issueData.state}`;
  }
}

export function formatBody(
  body: string,
  imageUrlMap: Map<string, string>,
): string {
  let processedBody = stripHtmlComments(body);

  // Replace image URLs with local paths
  for (const [originalUrl, localPath] of imageUrlMap) {
    processedBody = processedBody.replaceAll(originalUrl, localPath);
  }

  return processedBody;
}

export function formatComments(
  comments: GitHubComment[],
  imageUrlMap?: Map<string, string>,
): string {
  return comments
    .map((comment) => {
      let body = stripHtmlComments(comment.body);

      // Replace image URLs with local paths if we have a mapping
      if (imageUrlMap && body) {
        for (const [originalUrl, localPath] of imageUrlMap) {
          body = body.replaceAll(originalUrl, localPath);
        }
      }

      return `[${comment.author.login} at ${comment.createdAt}]: ${body}`;
    })
    .join("\n\n");
}

export function formatReviewComments(
  reviewData: { nodes: GitHubReview[] } | null,
  imageUrlMap?: Map<string, string>,
): string {
  if (!reviewData || !reviewData.nodes) {
    return "";
  }

  const formattedReviews = reviewData.nodes.map((review) => {
    let reviewOutput = `[Review by ${review.author.login} at ${review.submittedAt}]: ${review.state}`;

    if (
      review.comments &&
      review.comments.nodes &&
      review.comments.nodes.length > 0
    ) {
      const comments = review.comments.nodes
        .map((comment) => {
          let body = stripHtmlComments(comment.body);

          // Replace image URLs with local paths if we have a mapping
          if (imageUrlMap) {
            for (const [originalUrl, localPath] of imageUrlMap) {
              body = body.replaceAll(originalUrl, localPath);
            }
          }

          return `  [Comment on ${comment.path}:${comment.line || "?"}]: ${body}`;
        })
        .join("\n");
      reviewOutput += `\n${comments}`;
    }

    return reviewOutput;
  });

  return formattedReviews.join("\n\n");
}

export function formatChangedFiles(changedFiles: GitHubFile[]): string {
  return changedFiles
    .map(
      (file) =>
        `- ${file.path} (${file.changeType}) +${file.additions}/-${file.deletions}`,
    )
    .join("\n");
}

export function formatChangedFilesWithSHA(
  changedFiles: GitHubFileWithSHA[],
): string {
  return changedFiles
    .map(
      (file) =>
        `- ${file.path} (${file.changeType}) +${file.additions}/-${file.deletions} SHA: ${file.sha}`,
    )
    .join("\n");
}
