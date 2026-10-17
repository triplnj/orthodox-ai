import Link from "next/link";
import { redirect } from "next/navigation";
import { getBlogAdminUser } from "@/lib/blogAdmin";
import { createBlogPost } from "../actions";
import { BlogContentEditor } from "@/components/blog/BlogContentEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Blog Post | OrthodoxAI",
};

export default async function NewBlogPostPage() {
  const adminUser = await getBlogAdminUser();

  if (!adminUser) {
    redirect("/login");
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
        New blog post
      </h1>

      <form action={createBlogPost} className="mt-10 space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Title
          </label>
          <input
            name="title"
            required
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            placeholder="How to Begin Praying as an Orthodox Christian"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Slug
          </label>
          <input
            name="slug"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            placeholder="how-to-begin-praying-as-an-orthodox-christian"
          />
          <p className="mt-2 text-xs text-gray-500">
            Leave empty to generate automatically from title.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Category
          </label>
          <input
            name="category"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            placeholder="Prayer"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Excerpt
          </label>
          <textarea
            name="excerpt"
            rows={3}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
            placeholder="Short description shown on the blog list and SEO metadata."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Content
          </label>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Paste from Word or Google Docs here. Basic formatting such as headings, paragraphs, lists, bold and italic text will be kept.
          </p>
          <BlogContentEditor name="content" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Status
          </label>
          <select
            name="status"
            defaultValue="DRAFT"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Create post
        </button>
      </form>
    </main>
  );
}
