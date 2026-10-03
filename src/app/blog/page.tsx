import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBlogAdminUser } from "@/lib/blogAdmin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "OrthodoxAI Blog | Orthodox Christian Learning and Daily Practice",
  description:
    "Short Orthodox Christian articles on prayer, fasting, confession preparation, Orthodox basics, and responsible use of AI.",
};

export default async function BlogPage() {
  const [posts, adminUser] = await Promise.all([
    prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
      },
      orderBy: {
        publishedAt: "desc",
      },
    }),
    getBlogAdminUser(),
  ]);

  const isAdmin = Boolean(adminUser);

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-300">
            OrthodoxAI Blog
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Orthodox Christian learning for daily life
          </h1>

          <p className="mt-5 text-base leading-7 text-gray-200">
            Short reflections and practical guides on Orthodox prayer, fasting,
            Scripture, confession preparation, and daily Christian discipline.
            OrthodoxAI is an educational tool and does not replace the Church, a
            priest, confession, or pastoral guidance.
          </p>

          {isAdmin && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/blog/new"
                className="rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-gray-950 hover:bg-gray-100"
              >
                New post
              </Link>

              <Link
                href="/admin/blog"
                className="rounded-xl border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
              >
                Manage posts
              </Link>
            </div>
          )}
        </section>

        {posts.length === 0 ? (
          <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-gray-200 shadow-sm">
            No blog posts have been published yet.
          </section>
        ) : (
          <section className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-sm transition hover:border-gray-400"
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

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex text-sm font-semibold text-gray-950 hover:underline"
                  >
                    Read article
                  </Link>

                  {isAdmin && (
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="inline-flex text-sm font-semibold text-blue-700 hover:underline"
                    >
                      Edit / delete
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
