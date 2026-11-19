import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionFromCookies } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== 'candidate' || !session.candidateId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appsRes = await query(
      `SELECT 
        a.application_id,
        a.candidate_id,
        a.job_id,
        a.status,
        a.match_score,
        a.applied_at,
        j.title AS job_title,
        c.name AS company_name,
        j.location AS job_location,
        j.status AS job_status,
        COALESCE(
          json_agg(
            json_build_object(
              'history_id', h.history_id,
              'old_status', h.old_status,
              'new_status', h.new_status,
              'changed_at', h.changed_at
            ) ORDER BY h.changed_at ASC
          ) FILTER (WHERE h.history_id IS NOT NULL), '[]'
        ) AS timeline
      FROM applications a
      JOIN jobs j ON j.job_id = a.job_id
      JOIN companies c ON c.company_id = j.company_id
      LEFT JOIN application_status_history h ON h.application_id = a.application_id
      WHERE a.candidate_id = $1
      GROUP BY a.application_id, j.job_id, c.name
      ORDER BY a.applied_at DESC`,
      [session.candidateId]
    );

    // Q9: recursive query - rebuild each application's full status journey from the audit trail
    const journeyRes = await query(
      `WITH RECURSIVE steps AS (
         SELECT h.application_id, h.new_status, h.changed_at,
                ROW_NUMBER() OVER (PARTITION BY h.application_id ORDER BY h.changed_at, h.history_id) AS step_no
         FROM application_status_history h
         JOIN applications a ON a.application_id = h.application_id
         WHERE a.candidate_id = $1
       ),
       journey AS (
         SELECT application_id, step_no, new_status::text AS path, changed_at AS started_at, changed_at
         FROM steps
         WHERE step_no = 1
         UNION ALL
         SELECT s.application_id, s.step_no, j.path || ' → ' || s.new_status::text, j.started_at, s.changed_at
         FROM journey j
         JOIN steps s ON s.application_id = j.application_id AND s.step_no = j.step_no + 1
       )
       SELECT DISTINCT ON (application_id)
         application_id, path AS status_journey, step_no AS stages,
         ROUND(EXTRACT(EPOCH FROM (changed_at - started_at)) / 86400.0, 1) AS days_in_pipeline
       FROM journey
       ORDER BY application_id, step_no DESC`,
      [session.candidateId]
    );
    const journeyById = new Map(journeyRes.rows.map((r: any) => [r.application_id, r]));
    const applications = appsRes.rows.map((a: any) => ({ ...a, journey: journeyById.get(a.application_id) || null }));

    return NextResponse.json({ applications });
  } catch (err: any) {
    console.error('Fetch applications error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== 'candidate' || !session.candidateId) {
      return NextResponse.json({ error: 'Unauthorized: Candidate login required' }, { status: 401 });
    }

    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Call transactional stored function apply_to_job(p_cand, p_job)
    // Validates job is open, deadline unexpired, duplicate check, computes score, inserts app and history
    const res = await query(
      'SELECT * FROM apply_to_job($1, $2)',
      [session.candidateId, jobId]
    );

    return NextResponse.json({
      success: true,
      application: res.rows[0],
    });
  } catch (err: any) {
    console.error('Apply to job error:', err);
    const msg = err.message || 'Failed to submit application';
    const status = err.code === '23505' ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
