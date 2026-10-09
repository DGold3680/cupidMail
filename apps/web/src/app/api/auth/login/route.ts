import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/db";
import { verifyPassword, hashPassword, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    let isValid = false;

    // Check if password hash exists and verify
    if (user.passwordHash) {
      isValid = verifyPassword(password, user.passwordHash);
    } else {
      // Bootstrap case: if admin user matches seeded credentials, set password hash
      if (normalizedEmail === "adsconversionng@gmail.com" && password === "1234567890") {
        isValid = true;
        const newHash = hashPassword(password);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash, role: Role.ADMIN },
        });
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createSessionToken(user);

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err?.message || "Failed to log in" }, { status: 500 });
  }
}

