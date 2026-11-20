-- ============================================================================
-- CareerLens: Role-Based Access Control inside the Database
-- Job, Skill and Recruitment Management System
-- DBMS Experiential Learning - Level 3
-- ============================================================================
-- The three application roles (users.role = 'candidate' | 'recruiter' | 'admin') are
-- mirrored by PostgreSQL roles, so the database itself decides what each role may do.
--
-- Demo (in psql):
--   SET ROLE candidate_role;
--   SELECT title FROM jobs LIMIT 3;          -- allowed
--   DELETE FROM jobs WHERE job_id = 1;       -- ERROR: permission denied for table jobs
--   RESET ROLE;
-- ============================================================================

-- 1. Create the roles (roles are cluster-wide, so only create them once)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'candidate_role') THEN
        CREATE ROLE candidate_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recruiter_role') THEN
        CREATE ROLE recruiter_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_role') THEN
        CREATE ROLE admin_role NOLOGIN;
    END IF;
END $$;

-- 2. Start with no privileges, then grant only what each role needs
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM candidate_role, recruiter_role, admin_role;
GRANT USAGE ON SCHEMA public TO candidate_role, recruiter_role, admin_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO candidate_role, recruiter_role, admin_role;

-- 3. Candidate: browse jobs, manage own profile/skills, apply and track applications
GRANT SELECT ON companies, skills, jobs, job_skills, job_embeddings TO candidate_role;
GRANT SELECT, UPDATE ON candidates TO candidate_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON candidate_skills TO candidate_role;
GRANT SELECT, INSERT, UPDATE ON resume_embeddings TO candidate_role;
GRANT SELECT, INSERT, DELETE ON applications TO candidate_role;
GRANT SELECT, INSERT ON application_status_history TO candidate_role;
-- (no INSERT/UPDATE/DELETE on jobs, and cannot change an application's status)

-- 4. Recruiter: manage job postings, view applicants, move applications through the pipeline
GRANT SELECT ON companies, skills, candidates TO recruiter_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs, job_skills, job_embeddings TO recruiter_role;
GRANT SELECT ON applications TO recruiter_role;
GRANT UPDATE (status) ON applications TO recruiter_role;      -- column-level: only the status
GRANT SELECT, INSERT ON application_status_history TO recruiter_role;
GRANT SELECT ON v_job_funnel, v_ranked_applicants TO recruiter_role;
-- (no access to candidate_skills or resume_embeddings)

-- 5. Admin: full CRUD on every table and view (can do everything a candidate or recruiter can, and more)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin_role;
