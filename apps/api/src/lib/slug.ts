import { prisma } from "./prisma.js";

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "workspace";
}

export async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let attempt = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${base}-${attempt}`.slice(0, 48);
  }
  return slug;
}

export function projectKeyFromName(name: string) {
  const letters = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 4) || "PRJ").padEnd(2, "X").slice(0, 6);
}
