import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: { message: "Administrator authentication is required." } },
      { status: 401 }
    );
  }
  if (!projectId) {
    return NextResponse.json(
      { error: { message: "Firebase project configuration is unavailable." } },
      { status: 500 }
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid verification request." } },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(
      `https://us-central1-${projectId}.cloudfunctions.net/verifyReleaseArtifact`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization
        },
        body: JSON.stringify(requestBody),
        cache: "no-store"
      }
    );
    const responseBody = await upstream.text();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Release verification proxy failed", error);
    return NextResponse.json(
      { error: { message: "Release verification service is unavailable." } },
      { status: 502 }
    );
  }
}
