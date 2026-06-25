import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { hashPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Mot de passe trop court (min 6 caractères)" }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    const displayName = name?.trim() || normalizedEmail.split("@")[0];
    const image = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=4f46e5`;
    const hashed = hashPassword(password);
    const user = await db.user.create({
      data: { email: normalizedEmail, name: displayName, image, password: hashed },
    });
    const existingCategories = await db.category.count({ where: { userId: user.id } });
    if (existingCategories === 0) {
      await db.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id })),
      });
    }
    return NextResponse.json({ success: true, email: user.email, name: user.name });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}