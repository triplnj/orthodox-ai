import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBlogAdminUser } from "@/lib/blogAdmin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog Admin | OrthodoxAI",
};

export default async function AdminBlogPage() {
  const adminUser = await getBlogAdminUser();

  if (!adminUser) {
    redirect("/login");
  }

  const posts = await prisma.blogPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Admin
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
            Blog posts
          </h1>
        </div>

        <Link
          href="/admin/blog/new"
          className="rounded-xl bg-gray-950 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-gray-800"
        >
          New blog post
        </Link>
      </div>

      <section className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {posts.length === 0 ? (
          <div className="p-8 text-sm text-gray-600">
            No blog posts yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {posts.map((post) => (
              <article
                key={post.id}
                className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {post.status}
                    </span>

                    {post.category && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                        {post.category}
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 text-xl font-semibold text-gray-950">
                    {post.title}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    /blog/{post.slug}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Created:{" "}
                    {post.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex gap-3">
                  {post.status === "PUBLISHED" && (
                    <Link
                      href={`/blog/${post.slug}`}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-gray-950"
                    >
                      View
                    </Link>
                  )}

                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}