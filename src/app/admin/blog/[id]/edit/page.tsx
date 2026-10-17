import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBlogAdminUser } from "@/lib/blogAdmin";
import { renderBlogContent } from "@/lib/blogContent";
import { updateBlogPost, deleteBlogPost } from "../../actions";
import { BlogContentEditor } from "@/components/blog/BlogContentEditor";

export const dynamic = "force-dynamic";

type EditBlogPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: EditBlogPostPageProps) {
  if (!(await getBlogAdminUser())) redirect("/login");
  const { id } = await params;

  const post = await prisma.blogPost.findUnique({
    where: {
      id,
    },
    select: {
      title: true,
    },
  });

  return {
    title: post ? `Edit ${post.title} | OrthodoxAI` : "Edit Blog Post",
  };
}

export default async function EditBlogPostPage({
  params,
}: EditBlogPostPageProps) {
  const adminUser = await getBlogAdminUser();

  if (!adminUser) {
    redirect("/login");
  }

  const { id } = await params;

  const post = await prisma.blogPost.findUnique({
    where: {
      id,
    },
  });

  if (!post) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin/blog"
        className="text-sm font-semibold text-gray-600 hover:text-gray-950"
      >
        ← Back to blog admin
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-950">
        Edit blog post
      </h1>

      <form action={updateBlogPost} className="mt-10 space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <input type="hidden" name="id" value={post.id} />

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Title
          </label>
          <input
            name="title"
            required
            defaultValue={post.title}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Slug
          </label>
          <input
            name="slug"
            required
            defaultValue={post.slug}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Category
          </label>
          <input
            name="category"
            defaultValue={post.category ?? ""}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Excerpt
          </label>
          <textarea
            name="excerpt"
            rows={3}
            defaultValue={post.excerpt ?? ""}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Content
          </label>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Paste from Word or Google Docs here. Basic formatting such as headings, paragraphs, lists, bold and italic text will be kept.
          </p>
          <BlogContentEditor name="content" defaultValue={renderBlogContent(post.content)} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Status
          </label>
          <select
            name="status"
            defaultValue={post.status}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Save changes
          </button>

          {post.status === "PUBLISHED" && (
            <Link
              href={`/blog/${post.slug}`}
              className="rounded-xl border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              View public post
            </Link>
          )}
        </div>
      </form>

      <form action={deleteBlogPost} className="mt-10 border-t border-red-200 pt-8">
        <input type="hidden" name="id" value={post.id} />

        <button
          type="submit"
          className="rounded-xl border border-red-300 px-6 py-3 text-sm font-semibold text-red-700 hover:border-red-700"
        >
          Delete post
        </button>
      </form>
    </main>
  );
}
