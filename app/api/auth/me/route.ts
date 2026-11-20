import { NextResponse } from 'next/server';
import { getSessionFromCookies, fetchFullUserSession } from '@/lib/auth';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const updatedSession = await fetchFullUserSession(session.userId);
  if (!updatedSession) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  // keep the "admin is acting as this user" marker so the UI can offer "Back to Admin"
  return NextResponse.json({ user: { ...updatedSession, adminUserId: session.adminUserId } });
}
