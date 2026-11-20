import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { query, getClient } from '@/lib/db';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { generateEmbedding, formatVectorForPg } from '@/lib/embeddings';
import { getTableDef, TableDef } from '@/lib/adminTables';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------- READ queries (one per table)
const LIST_SQL: Record<string, string> = {
  candidates: `
    SELECT c.candidate_id, c.user_id, u.email, c.full_name, c.phone, c.location, c.education,
           c.years_experience, c.summary, c.resume_text,
           (SELECT COUNT(*) FROM candidate_skills cs WHERE cs.candidate_id = c.candidate_id) AS skill_count,
           (SELECT COUNT(*) FROM applications a WHERE a.candidate_id = c.candidate_id) AS application_count
    FROM candidates c JOIN users u ON u.user_id = c.user_id
    ORDER BY c.candidate_id`,
  recruiters: `
    SELECT r.recruiter_id, r.user_id, u.email, r.full_name, r.company_id, co.name AS company_name, r.designation,
           (SELECT COUNT(*) FROM jobs j WHERE j.recruiter_id = r.recruiter_id) AS job_count
    FROM recruiters r JOIN users u ON u.user_id = r.user_id JOIN companies co ON co.company_id = r.company_id
    ORDER BY r.recruiter_id`,
  jobs: `
    SELECT j.job_id, j.recruiter_id, j.company_id, j.title, j.description, j.location, j.salary_min, j.salary_max,
           j.openings, to_char(j.deadline, 'YYYY-MM-DD') AS deadline, j.status,
           co.name AS company_name, r.full_name AS recruiter_name,
           COALESCE('$' || ROUND(j.salary_min / 1000.0) || 'k - $' || ROUND(j.salary_max / 1000.0) || 'k', '') AS salary_range,
           (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.job_id) AS application_count
    FROM jobs j JOIN companies co ON co.company_id = j.company_id JOIN recruiters r ON r.recruiter_id = j.recruiter_id
    ORDER BY j.job_id`,
  applications: `
    SELECT a.application_id, a.candidate_id, a.job_id, c.full_name AS candidate_name, j.title AS job_title,
           a.status, a.match_score, to_char(a.applied_at, 'YYYY-MM-DD HH24:MI') AS applied_at
    FROM applications a JOIN candidates c ON c.candidate_id = a.candidate_id JOIN jobs j ON j.job_id = a.job_id
    ORDER BY a.application_id`,
  candidate_skills: `
    SELECT cs.candidate_id, cs.skill_id, c.full_name AS candidate_name, s.name AS skill_name, cs.proficiency, cs.years_used
    FROM candidate_skills cs JOIN candidates c ON c.candidate_id = cs.candidate_id JOIN skills s ON s.skill_id = cs.skill_id
    ORDER BY c.full_name, s.name`,
  job_skills: `
    SELECT js.job_id, js.skill_id, j.title AS job_title, s.name AS skill_name, js.weight, js.is_mandatory
    FROM job_skills js JOIN jobs j ON j.job_id = js.job_id JOIN skills s ON s.skill_id = js.skill_id
    ORDER BY js.job_id, js.weight DESC`,
  companies: `SELECT company_id, name, industry, location, website FROM companies ORDER BY company_id`,
  skills: `SELECT skill_id, name, category FROM skills ORDER BY category, name`,
  users: `
    SELECT u.user_id, u.email, u.role, to_char(u.created_at, 'YYYY-MM-DD') AS created_at,
           COALESCE(c.full_name, r.full_name, CASE WHEN u.role = 'admin' THEN 'Administrator' END) AS display_name
    FROM users u
    LEFT JOIN candidates c ON c.user_id = u.user_id
    LEFT JOIN recruiters r ON r.user_id = u.user_id
    ORDER BY u.user_id`,
  history: `
    SELECT h.history_id, h.application_id, c.full_name AS candidate_name, j.title AS job_title,
           h.old_status, h.new_status, to_char(h.changed_at, 'YYYY-MM-DD HH24:MI') AS changed_at
    FROM application_status_history h
    JOIN applications a ON a.application_id = h.application_id
    JOIN candidates c ON c.candidate_id = a.candidate_id
    JOIN jobs j ON j.job_id = a.job_id
    ORDER BY h.changed_at DESC
    LIMIT 300`,
};

// dropdown options for "ref" fields
const REF_SQL: Record<string, string> = {
  candidates: `SELECT candidate_id AS value, full_name AS label FROM candidates ORDER BY full_name`,
  recruiters: `SELECT r.recruiter_id AS value, r.full_name || ' (' || co.name || ')' AS label
               FROM recruiters r JOIN companies co ON co.company_id = r.company_id ORDER BY r.full_name`,
  companies: `SELECT company_id AS value, name AS label FROM companies ORDER BY name`,
  skills: `SELECT skill_id AS value, name || ' (' || category || ')' AS label FROM skills ORDER BY name`,
  jobs: `SELECT j.job_id AS value, '#' || j.job_id || ' ' || j.title || ' - ' || co.name AS label
         FROM jobs j JOIN companies co ON co.company_id = j.company_id ORDER BY j.job_id`,
};

// real table name for each admin key (whitelist)
const TABLE_NAME: Record<string, string> = {
  candidates: 'candidates', recruiters: 'recruiters', jobs: 'jobs', applications: 'applications',
  candidate_skills: 'candidate_skills', job_skills: 'job_skills', companies: 'companies', skills: 'skills', users: 'users',
};

// ---------------------------------------------------------------- helpers
function clean(def: TableDef, data: Record<string, any>, mode: 'create' | 'edit') {
  // keep only whitelisted fields for this mode, converting '' to NULL and typing values
  const out: Record<string, any> = {};
  for (const f of def.fields) {
    if (mode === 'create' && f.editOnly) continue;
    if (mode === 'edit' && f.createOnly) continue;
    if (f.type === 'password') continue; // handled separately (hashed)
    if (!(f.name in data)) continue;
    let v = data[f.name];
    if (v === '' || v === undefined) v = null;
    if (v !== null && f.type === 'number') v = Number(v);
    if (f.type === 'ref' && v !== null) v = Number(v);
    if (f.type === 'boolean') v = v === true || v === 'true';
    out[f.name] = v;
  }
  return out;
}

function missingRequired(def: TableDef, data: Record<string, any>, mode: 'create' | 'edit') {
  return def.fields
    .filter((f) => f.required && !(mode === 'create' && f.editOnly) && !(mode === 'edit' && f.createOnly))
    .filter((f) => data[f.name] === undefined || data[f.name] === null || data[f.name] === '')
    .map((f) => f.label);
}

async function insertRow(client: PoolClient | null, table: string, values: Record<string, any>) {
  const cols = Object.keys(values);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
  const params = cols.map((c) => values[c]);
  return client ? client.query(sql, params) : query(sql, params);
}

async function updateRow(client: PoolClient | null, table: string, pk: Record<string, any>, values: Record<string, any>) {
  const cols = Object.keys(values);
  if (cols.length === 0) return null;
  const pkCols = Object.keys(pk);
  const sql = `UPDATE ${table} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}
               WHERE ${pkCols.map((c, i) => `${c} = $${cols.length + i + 1}`).join(' AND ')} RETURNING *`;
  const params = [...cols.map((c) => values[c]), ...pkCols.map((c) => pk[c])];
  return client ? client.query(sql, params) : query(sql, params);
}

async function refreshCandidateEmbedding(client: PoolClient, candidateId: number) {
  const res = await client.query(
    `SELECT c.summary, c.resume_text,
            (SELECT string_agg(s.name, ', ') FROM candidate_skills cs JOIN skills s ON s.skill_id = cs.skill_id
             WHERE cs.candidate_id = c.candidate_id) AS skill_names
     FROM candidates c WHERE c.candidate_id = $1`,
    [candidateId]
  );
  const c = res.rows[0];
  if (!c) return;
  const vec = await generateEmbedding(`${c.summary || ''}. ${c.resume_text}. Skills: ${c.skill_names || ''}`);
  await client.query(
    `INSERT INTO resume_embeddings (candidate_id, embedding, model_name, updated_at)
     VALUES ($1, $2::vector, 'all-MiniLM-L6-v2', now())
     ON CONFLICT (candidate_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()`,
    [candidateId, formatVectorForPg(vec)]
  );
}

async function refreshJobEmbedding(client: PoolClient, jobId: number) {
  const res = await client.query(
    `SELECT j.title, j.description,
            (SELECT string_agg(s.name, ', ') FROM job_skills js JOIN skills s ON s.skill_id = js.skill_id
             WHERE js.job_id = j.job_id) AS skill_names
     FROM jobs j WHERE j.job_id = $1`,
    [jobId]
  );
  const j = res.rows[0];
  if (!j) return;
  const vec = await generateEmbedding(`${j.title}. ${j.description} Required Skills: ${j.skill_names || ''}`);
  await client.query(
    `INSERT INTO job_embeddings (job_id, embedding, model_name, updated_at)
     VALUES ($1, $2::vector, 'all-MiniLM-L6-v2', now())
     ON CONFLICT (job_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()`,
    [jobId, formatVectorForPg(vec)]
  );
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function pkFrom(def: TableDef, body: any): Record<string, any> | null {
  const pk: Record<string, any> = {};
  for (const col of def.pk) {
    const v = body?.pk?.[col];
    if (v === undefined || v === null || v === '') return null;
    pk[col] = Number(v);
  }
  return pk;
}

function errorResponse(err: any) {
  const msg = err?.detail ? `${err.message} (${err.detail})` : err?.message || 'Operation failed';
  return NextResponse.json({ error: msg }, { status: 400 });
}

// ---------------------------------------------------------------- GET: list rows (+ dropdown options)
export async function GET(_req: Request, { params }: { params: { table: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def || !LIST_SQL[def.key]) return NextResponse.json({ error: 'Unknown table' }, { status: 404 });

  try {
    const rows = (await query(LIST_SQL[def.key])).rows;
    const refs: Record<string, { value: number; label: string }[]> = {};
    for (const f of def.fields) {
      if (f.type === 'ref' && f.ref && REF_SQL[f.ref] && !refs[f.ref]) {
        refs[f.ref] = (await query(REF_SQL[f.ref])).rows;
      }
    }
    return NextResponse.json({ rows, refs });
  } catch (err: any) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------- POST: create
export async function POST(req: Request, { params }: { params: { table: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def || !def.canCreate) return NextResponse.json({ error: 'Create not allowed' }, { status: 400 });

  const body = await req.json();
  const data = body?.data || {};
  const missing = missingRequired(def, data, 'create');
  if (missing.length) return NextResponse.json({ error: `Required: ${missing.join(', ')}` }, { status: 400 });
  const values = clean(def, data, 'create');

  try {
    let row: any;
    switch (def.key) {
      case 'users': {
        if (String(data.password || '').length < 6) throw new Error('Password must be at least 6 characters');
        const res = await query(
          `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') RETURNING user_id, email, role`,
          [values.email, await hashPassword(data.password)]
        );
        row = res.rows[0];
        break;
      }
      case 'candidates': {
        if (String(data.password || '').length < 6) throw new Error('Password must be at least 6 characters');
        row = await inTransaction(async (client) => {
          const u = await client.query(
            `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'candidate') RETURNING user_id`,
            [data.email, await hashPassword(data.password)]
          );
          const { email, ...profile } = values;
          const c = await insertRow(client, 'candidates', { user_id: u.rows[0].user_id, ...profile });
          await refreshCandidateEmbedding(client, c.rows[0].candidate_id);
          return c.rows[0];
        });
        break;
      }
      case 'recruiters': {
        if (String(data.password || '').length < 6) throw new Error('Password must be at least 6 characters');
        row = await inTransaction(async (client) => {
          const u = await client.query(
            `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'recruiter') RETURNING user_id`,
            [data.email, await hashPassword(data.password)]
          );
          const { email, ...profile } = values;
          const r = await insertRow(client, 'recruiters', { user_id: u.rows[0].user_id, ...profile });
          return r.rows[0];
        });
        break;
      }
      case 'jobs': {
        row = await inTransaction(async (client) => {
          const rec = await client.query('SELECT company_id FROM recruiters WHERE recruiter_id = $1', [values.recruiter_id]);
          if (rec.rowCount === 0) throw new Error('Recruiter not found');
          const j = await insertRow(client, 'jobs', { ...values, company_id: rec.rows[0].company_id });
          await refreshJobEmbedding(client, j.rows[0].job_id);
          return j.rows[0];
        });
        break;
      }
      case 'applications': {
        // same transactional procedure the candidate's Apply button uses
        const res = await query('SELECT * FROM apply_to_job($1, $2)', [values.candidate_id, values.job_id]);
        row = res.rows[0];
        break;
      }
      default: {
        const res = await insertRow(null, TABLE_NAME[def.key], values);
        row = res.rows[0];
      }
    }
    return NextResponse.json({ success: true, row });
  } catch (err: any) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------- PUT: update
export async function PUT(req: Request, { params }: { params: { table: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def || !def.canEdit) return NextResponse.json({ error: 'Edit not allowed' }, { status: 400 });

  const body = await req.json();
  const pk = pkFrom(def, body);
  if (!pk) return NextResponse.json({ error: 'Missing primary key' }, { status: 400 });
  const data = body?.data || {};
  const missing = missingRequired(def, data, 'edit');
  if (missing.length) return NextResponse.json({ error: `Required: ${missing.join(', ')}` }, { status: 400 });
  const values = clean(def, data, 'edit');

  try {
    let row: any;
    switch (def.key) {
      case 'users': {
        if (data.password) {
          if (String(data.password).length < 6) throw new Error('Password must be at least 6 characters');
          values.password_hash = await hashPassword(data.password);
        }
        const res = await updateRow(null, 'users', pk, values);
        row = res?.rows[0];
        break;
      }
      case 'candidates': {
        row = await inTransaction(async (client) => {
          const r = await updateRow(client, 'candidates', pk, values);
          await refreshCandidateEmbedding(client, pk.candidate_id);
          return r?.rows[0];
        });
        break;
      }
      case 'jobs': {
        row = await inTransaction(async (client) => {
          const r = await updateRow(client, 'jobs', pk, values);
          await refreshJobEmbedding(client, pk.job_id);
          return r?.rows[0];
        });
        break;
      }
      default: {
        const res = await updateRow(null, TABLE_NAME[def.key], pk, values);
        row = res?.rows[0];
      }
    }
    if (!row) return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    return NextResponse.json({ success: true, row });
  } catch (err: any) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------- DELETE
export async function DELETE(req: Request, { params }: { params: { table: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const def = getTableDef(params.table);
  if (!def || !def.canDelete) return NextResponse.json({ error: 'Delete not allowed' }, { status: 400 });

  const body = await req.json();
  const pk = pkFrom(def, body);
  if (!pk) return NextResponse.json({ error: 'Missing primary key' }, { status: 400 });

  try {
    let res;
    if (def.key === 'users' && pk.user_id === admin.userId) {
      throw new Error('You cannot delete your own admin account while logged in');
    }
    if (def.key === 'candidates') {
      // delete the login account; ON DELETE CASCADE removes profile, skills, applications, embedding
      res = await query(
        'DELETE FROM users WHERE user_id = (SELECT user_id FROM candidates WHERE candidate_id = $1) RETURNING user_id',
        [pk.candidate_id]
      );
    } else if (def.key === 'recruiters') {
      res = await query(
        'DELETE FROM users WHERE user_id = (SELECT user_id FROM recruiters WHERE recruiter_id = $1) RETURNING user_id',
        [pk.recruiter_id]
      );
    } else {
      const table = TABLE_NAME[def.key];
      const cols = Object.keys(pk);
      res = await query(
        `DELETE FROM ${table} WHERE ${cols.map((c, i) => `${c} = $${i + 1}`).join(' AND ')} RETURNING *`,
        cols.map((c) => pk[c])
      );
    }
    if (!res.rowCount) return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err);
  }
}
