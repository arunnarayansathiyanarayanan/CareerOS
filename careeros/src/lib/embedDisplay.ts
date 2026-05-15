/** Resolve a watch URL to a YouTube embed URL, or null if unknown. */
export function youtubeEmbedUrlFromWatchUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      }
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[embedIdx + 1]!)}`;
      }
      const shortIdx = parts.indexOf("shorts");
      if (shortIdx >= 0 && parts[shortIdx + 1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[shortIdx + 1]!)}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolve a Loom share URL to an embed URL. */
export function loomEmbedUrlFromShareUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (!host.endsWith("loom.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const shareIdx = parts.indexOf("share");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) {
      return `https://www.loom.com/embed/${parts[embedIdx + 1]}`;
    }
    if (shareIdx >= 0 && parts[shareIdx + 1]) {
      return `https://www.loom.com/embed/${parts[shareIdx + 1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

export type ParsedGithubRepo = {
  owner: string;
  repo: string;
  href: string;
};

export function parseGithubRepoUrl(raw: string): ParsedGithubRepo | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/, "");
    return {
      owner,
      repo,
      href: `https://github.com/${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}
