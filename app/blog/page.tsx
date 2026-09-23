import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../Nav";
import { formatDate, getPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog · Adith Mohanty",
};

export default function BlogPage() {
  const posts = getPosts();

  return (
    <>
      <Nav />
      <main className="page-body page-body--top">
        <h1 className="page-title">Blog</h1>
        <div className="rule" />

        {posts.length === 0 ? (
          <p className="empty-note">No posts yet.</p>
        ) : (
          <ul className="post-list">
            {posts.map((p) => (
              <li key={p.slug}>
                <Link className="post-link" href={`/blog/${p.slug}`}>
                  <span className="post-link-title">{p.title}</span>
                  {p.date && <span className="entry-meta">{formatDate(p.date)}</span>}
                </Link>
                {p.summary && <p className="post-summary">{p.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
