import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "OrthodoxAI Blog | Orthodox Christian Learning and Daily Practice",
  description:
    "Short Orthodox Christian articles on prayer, fasting, confession preparation, Orthodox basics, and responsible use of AI.",
};

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "PUBLISHED",
    },
    orderBy: {
      publishedAt: "desc",
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          OrthodoxAI Blog
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          Orthodox Christian learning for daily life
        </h1>

        <p className="mt-5 text-base leading-7 text-gray-600">
          Short reflections and practical guides on Orthodox prayer, fasting,
          Scripture, confession preparation, and daily Christian discipline.
          OrthodoxAI is an educational tool and does not replace the Church, a
          priest, confession, or pastoral guidance.
        </p>
      </section>

      {posts.length === 0 ? (
        <section className="mt-12 rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
          No blog posts have been published yet.
        </section>
      ) : (
        <section className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-950"
            >
              {post.category && (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {post.category}
                </p>
              )}

              <h2 className="mt-3 text-xl font-semibold leading-7 text-gray-950">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>

              {post.excerpt && (
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {post.excerpt}
                </p>
              )}

              <div className="mt-5 text-xs text-gray-500">
                {post.publishedAt
                  ? post.publishedAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
              </div>

              <Link
                href={`/blog/${post.slug}`}
                className="mt-5 inline-flex text-sm font-semibold text-gray-950 hover:underline"
              >
                Read article
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}