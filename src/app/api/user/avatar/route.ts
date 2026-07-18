import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import sharp from "sharp";

const MAX_SIZE = 8 * 1024 * 1024;
const AVATAR_SIZE = 200;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image trop volumineuse (max 8 Mo)." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    // Decode + resize with sharp (supports JPEG, PNG, WebP, GIF, AVIF, TIFF and
    // HEIC when libvips is built with it). Reject only if sharp cannot decode
    // the actual bytes, regardless of the (sometimes wrong) MIME type.
    let resized: Buffer;
    try {
      resized = await sharp(Buffer.from(bytes))
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "Format d'image non supporté. Utilise JPEG, PNG, WebP, GIF, AVIF ou HEIC." },
        { status: 400 },
      );
    }
    const base64 = resized.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    await db.user.update({
      where: { id: session.user.id },
      data: { image: dataUrl },
    });

    return NextResponse.json({ image: dataUrl });
  } catch (e) {
    console.error("[avatar]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
