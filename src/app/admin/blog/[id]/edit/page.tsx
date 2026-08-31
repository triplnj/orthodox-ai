import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBlogAdminUser } from "@/lib/blogAdmin";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";

type EditBlogPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function updateBlogPost(formData: FormData) {
  "use server";

  const adminUser = await getBlogAdminUser();

  if (!adminUser) {
    redirect("/login");
  }

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");

  if (!id || !title || !content) {
    throw new Error("Missing required fields.");
  }

  const existingPost = await prisma.blogPost.findUnique({
    where: {
      id,
    },
    select: {
      publishedAt: true,
    },
  });

  if (!existingPost) {
    throw new Error("Blog post not found.");
  }

  const slug = rawSlug ? slugify(rawSlug) : slugify(title);

  await prisma.blogPost.update({
    where: {
      id,
    },
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      category: category || null,
      content,
      status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      publishedAt:
        status === "PUBLISHED"
          ? existingPost.publishedAt ?? new Date()
          : null,
      authorEmail: adminUser.email,
    },
  });

  redirect("/admin/blog");
}

async function deleteBlogPost(formData: FormData) {
  "use server";

  const adminUser = await getBlogAdminUser();

  if (!adminUser) {
    redirect("/login");
  }

  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Missing blog post id.");
  }

  await prisma.blogPost.delete({
    where: {
      id,
    },
  });

  redirect("/admin/blog");
}

export async function generateMetadata({ params }: EditBlogPostPageProps) {
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

      <form action={updateBlogPost} className="mt-10 space-y-6">
        <input type="hidden" name="id" value={post.id} />

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Title
          </label>
          <input
            name="title"
            required
            defaultValue={post.title}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Category
          </label>
          <input
            name="category"
            defaultValue={post.category ?? ""}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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
            defaultValue={post.content}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none focus:border-gray-950"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Status
          </label>
          <select
            name="status"
            defaultValue={post.status}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-950"
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