import { NextResponse } from 'next/server';
import { requireAdmin, getSessionFromCookies, fetchFullUserSession, signToken, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

// POST { userId }: admin starts acting as a candidate or recruiter, so every candidate/recruiter
// page and API works for the admin exactly as it does for that user.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { userId } = await req.json();
  const target = await fetchFullUserSession(Number(userId));
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.role === 'admin') return NextResponse.json({ error: 'Choose a candidate or recruiter account' }, { status: 400 });
  if (target.role === 'candidate' && !target.candidateId) return NextResponse.json({ error: 'Candidate has no profile' }, { status: 400 });
  if (target.role === 'recruiter' && !target.recruiterId) return NextResponse.json({ error: 'Recruiter has no profile' }, { status: 400 });

  const session = { ...target, adminUserId: admin.userId };
  const res = NextResponse.json({ success: true, user: session });
  res.cookies.set(COOKIE_NAME, signToken(session), COOKIE_OPTIONS);
  return res;
}

// DELETE: stop acting and return to the admin account
export async function DELETE() {
  const session = await getSessionFromCookies();
  if (!session?.adminUserId) return NextResponse.json({ error: 'Not acting as another user' }, { status: 400 });

  const admin = await fetchFullUserSession(session.adminUserId);
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: 'Admin account not found' }, { status: 403 });

  const res = NextResponse.json({ success: true, user: admin });
  res.cookies.set(COOKIE_NAME, signToken(admin), COOKIE_OPTIONS);
  return res;
}
