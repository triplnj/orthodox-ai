import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug } = await params;

  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
    },
    select: {
      title: true,
      excerpt: true,
    },
  });

  if (!post) {
    return {
      title: "Article not found | OrthodoxAI",
    };
  }

  return {
    title: `${post.title} | OrthodoxAI Blog`,
    description: post.excerpt ?? undefined,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
    },
  });

  if (!post) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/blog"
        className="text-sm font-semibold text-gray-600 hover:text-gray-950"
      >
        ← Back to blog
      </Link>

      <article className="mt-8">
        {post.category && (
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {post.category}
          </p>
        )}

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="mt-5 text-base leading-7 text-gray-600">
            {post.excerpt}
          </p>
        )}

        <div className="mt-6 text-sm text-gray-500">
          {post.publishedAt
            ? post.publishedAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : ""}
        </div>

        <div className="mt-10 space-y-6 text-base leading-8 text-gray-700">
          {post.content
            .trim()
            .split("\n\n")
            .map((paragraph, index) => (
              <p key={index}>{paragraph.trim()}</p>
            ))}
        </div>
      </article>

      <section className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-xl font-semibold text-gray-950">
          Continue with OrthodoxAI
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          OrthodoxAI helps with Orthodox Christian learning, prayer routines,
          Scripture reading, fasting education, journaling, and confession
          preparation. It does not replace the Church, a priest, sacramental
          confession, or pastoral guidance.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-xl bg-gray-950 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
          >
            Start free
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-gray-300 px-5 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
          >
            Learn more
          </Link>
        </div>
      </section>
    </main>
  );
}