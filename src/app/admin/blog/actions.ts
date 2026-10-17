"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBlogAdminUser } from "@/lib/blogAdmin";
import { renderBlogContent, sanitizeBlogHtml } from "@/lib/blogContent";
import { slugify } from "@/lib/slugify";

// Pasted HTML must be sanitized before it enters the live contentEditable DOM.
export async function sanitizeBlogPaste(html: string) {
  if (!(await getBlogAdminUser())) redirect("/login");
  if (typeof html !== "string") throw new Error("Invalid blog HTML.");
  return sanitizeBlogHtml(html);
}

export async function createBlogPost(formData: FormData) {
  const adminUser = await getBlogAdminUser();
  if (!adminUser) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = renderBlogContent(String(formData.get("content") ?? "").trim());
  const status = String(formData.get("status") ?? "DRAFT");

  if (!title || !content || content === "<p></p>") {
    throw new Error("Title and content are required.");
  }

  const slug = slugify(rawSlug || title);
  if (!slug) throw new Error("Slug could not be generated.");

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

export async function updateBlogPost(formData: FormData) {
  const adminUser = await getBlogAdminUser();
  if (!adminUser) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = renderBlogContent(String(formData.get("content") ?? "").trim());
  const status = String(formData.get("status") ?? "DRAFT");

  if (!id || !title || !content || content === "<p></p>") {
    throw new Error("Missing required fields.");
  }
  const slug = slugify(rawSlug || title);
  if (!slug) throw new Error("Slug could not be generated.");

  const existingPost = await prisma.blogPost.findUnique({
    where: { id },
    select: { publishedAt: true },
  });
  if (!existingPost) throw new Error("Blog post not found.");

  await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug,
      excerpt: excerpt || null,
      category: category || null,
      content,
      status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      publishedAt: status === "PUBLISHED"
        ? existingPost.publishedAt ?? new Date()
        : null,
      authorEmail: adminUser.email,
    },
  });
  redirect("/admin/blog");
}

export async function deleteBlogPost(formData: FormData) {
  const adminUser = await getBlogAdminUser();
  if (!adminUser) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing blog post id.");
  await prisma.blogPost.delete({ where: { id } });
  redirect("/admin/blog");
}
