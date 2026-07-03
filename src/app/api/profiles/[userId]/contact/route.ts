import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Profile } from "@/models/Profile";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { contact: true },
      { new: true }
    );
    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: true, contact: true },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Mark contact error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
