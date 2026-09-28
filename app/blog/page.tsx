import type { Metadata } from "next";
import Link from "next/link";
import Nav from "../Nav";
import { formatDate, getPosts, tagSlug } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const { tag } = await searchParams;
  const active = typeof tag === "string" ? tag : undefined;
  const all = getPosts();
  const posts = active ? all.filter((p) => p.tags.some((t) => tagSlug(t) === active)) : all;

  const tags = new Map<string, string>();
  for (const p of all) for (const t of p.tags) tags.set(tagSlug(t), t);

  return (
    <>
      <Nav />
      <main className="page-body page-body--top">
        <h1 className="page-title">Blog</h1>
        <div className="rule" />

        {tags.size > 0 && (
          <div className="tags tag-filter">
            <Link className={`tag${active ? "" : " tag--active"}`} href="/blog">
              All
            </Link>
            {[...tags].map(([slug, label]) => (
              <Link
                key={slug}
                className={`tag${slug === active ? " tag--active" : ""}`}
                href={`/blog?tag=${slug}`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

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
                {p.tags.length > 0 && (
                  <div className="tags post-tags">
                    {p.tags.map((t) => (
                      <Link key={t} className="tag" href={`/blog?tag=${tagSlug(t)}`}>
                        {t}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
