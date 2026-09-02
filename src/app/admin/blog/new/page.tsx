import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBlogAdminUser } from "@/lib/blogAdmin";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";

async function createBlogPost(formData: FormData) {
  "use server";

  const adminUser = await getBlogAdminUser();

  if (!adminUser) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");

  if (!title || !content) {
    throw new Error("Title and content are required.");
  }

  const slug = rawSlug ? slugify(rawSlug) : slugify(title);

  if (!slug) {
    throw new Error("Slug could not be generated.");
  }

  await prisma.blogPost.create({
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      category: category || null,
      content,
      status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      authorEmail: adminUser.email,
    },
  });

  redirect("/admin/blog");
}

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

      <h1 className="mt-6 text-4xl font-bold tracking-tight text-white">
        New blog post
      </h1>

      <form action={createBlogPost} className="mt-10 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Title
          </label>
          <input
            name="title"
            required
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
            placeholder="How to Begin Praying as an Orthodox Christian"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Slug
          </label>
          <input
            name="slug"
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
            placeholder="Short description shown on the blog list and SEO metadata."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Content
          </label>
          <textarea
            name="content"
            required
            rows={18}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none focus:border-gray-950"
            placeholder="Write your blog post here. Use blank lines between paragraphs."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Status
          </label>
          <select
            name="status"
            defaultValue="DRAFT"
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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