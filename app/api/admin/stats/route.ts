import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Platform-wide numbers for the Admin Console overview
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const counts = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS admins,
        (SELECT COUNT(*) FROM candidates) AS candidates,
        (SELECT COUNT(*) FROM recruiters) AS recruiters,
        (SELECT COUNT(*) FROM companies) AS companies,
        (SELECT COUNT(*) FROM skills) AS skills,
        (SELECT COUNT(*) FROM jobs) AS jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'open') AS open_jobs,
        (SELECT COUNT(*) FROM applications) AS applications,
        (SELECT COUNT(*) FROM application_status_history) AS history_rows,
        (SELECT COUNT(*) FROM resume_embeddings) + (SELECT COUNT(*) FROM job_embeddings) AS vectors`);

    const byStatus = await query(`
      SELECT status, COUNT(*) AS count
      FROM applications
      GROUP BY status
      ORDER BY array_position(ARRAY['applied','screening','interview','offer','hired','rejected']::app_status[], status)`);

    return NextResponse.json({ counts: counts.rows[0], applicationsByStatus: byStatus.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
