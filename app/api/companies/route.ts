import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('activelyHiring') === 'true') {
      // Q5: companies with more than 2 open jobs (JOIN + GROUP BY + HAVING)
      const hiring = await query(
        `SELECT c.company_id, c.name, c.industry, COUNT(j.job_id) AS open_jobs
         FROM jobs j
         JOIN companies c ON c.company_id = j.company_id
         WHERE j.status = 'open'
         GROUP BY c.company_id, c.name, c.industry
         HAVING COUNT(j.job_id) > 2
         ORDER BY open_jobs DESC, c.name ASC`
      );
      return NextResponse.json({ companies: hiring.rows });
    }

    const res = await query('SELECT company_id, name, industry, location, website FROM companies ORDER BY name ASC');
    return NextResponse.json({ companies: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
