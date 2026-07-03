import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Profile } from "@/models/Profile";

/**
 * Mark profiles as read in bulk.
 * Body: { markAll?: boolean, userIds?: string[] }
 * - markAll: true → set readAt for all profiles (e.g. after importing 1600 contacted candidates).
 * - userIds: [...] → set readAt only for these profile userIds.
 */
export async function PATCH(request: Request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const markAll = body.markAll === true;
    const userIds = Array.isArray(body.userIds) ? body.userIds : undefined;

    const readAt = new Date();

    if (userIds?.length) {
      const result = await Profile.updateMany(
        { userId: { $in: userIds } },
        { $set: { readAt } }
      );
      return NextResponse.json({
        ok: true,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        message: `Marked ${result.modifiedCount} profile(s) as read.`,
      });
    }

    if (markAll) {
      const result = await Profile.updateMany({}, { $set: { readAt } });
      return NextResponse.json({
        ok: true,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        message: `Marked all ${result.modifiedCount} profile(s) as read.`,
      });
    }

    return NextResponse.json(
      { error: "Provide markAll: true or userIds: string[] in the body." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Mark read error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
