"use client";

import { useEffect, useState } from "react";

type Likes = { count: number; liked: boolean };

export default function LikeButton({ slug }: { slug: string }) {
  const [likes, setLikes] = useState<Likes | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/likes/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setLikes)
      .catch(() => {});
  }, [slug]);

  async function toggle() {
    if (!likes || busy) return;
    const liked = !likes.liked;
    const prev = likes;
    setBusy(true);
    setLikes({ liked, count: likes.count + (liked ? 1 : -1) });
    try {
      const r = await fetch(`/api/likes/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked }),
      });
      setLikes(r.ok ? await r.json() : prev);
    } catch {
      setLikes(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`like-button${likes?.liked ? " like-button--liked" : ""}`}
      onClick={toggle}
      disabled={!likes || busy}
      aria-pressed={likes?.liked ?? false}
      aria-label={likes?.liked ? "Unlike this post" : "Like this post"}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 5 6.6 5c2.1 0 3.6 1.2 5.4 3.1C13.8 6.2 15.3 5 17.4 5 21 5 23.1 8.6 21.6 11.9 19.5 16.4 12 21 12 21z" />
      </svg>
      <span>{likes ? likes.count : "–"}</span>
    </button>
  );
}
