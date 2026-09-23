import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "../../Nav";
import { formatDate, getPost, getPosts } from "@/lib/posts";
import { renderMarkdown } from "@/lib/markdown";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  return {
    title: post?.title ?? "Blog",
    description: post?.summary,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      <Nav />
      <main className="page-body page-body--top">
        <Link className="back-link" href="/blog">
          ← All posts
        </Link>
        <h1 className="page-title">{post.title}</h1>
        {post.date && <p className="entry-sub">{formatDate(post.date)}</p>}
        {post.cover && (
          <img className="post-cover" src={post.cover} alt="" />
        )}
        <article
          className="prose"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
        />
      </main>
    </>
  );
}
