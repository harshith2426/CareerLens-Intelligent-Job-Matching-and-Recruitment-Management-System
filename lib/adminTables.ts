// ============================================================================
// Admin Console: description of every table the admin can manage (CRUD).
// Shared by the admin page (forms + tables) and /api/admin/[table] (which only
// ever uses the column names listed here, so table/column names are whitelisted).
// ============================================================================

export type FieldType = 'text' | 'email' | 'password' | 'textarea' | 'number' | 'date' | 'boolean' | 'enum' | 'ref';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];   // for enum fields
  ref?: string;         // for ref fields: key of the table to pick from
  createOnly?: boolean; // shown only when creating
  editOnly?: boolean;   // shown only when editing
}

export interface ColumnDef {
  name: string;
  label: string;
}

export interface TableDef {
  key: string;
  label: string;
  description: string;
  pk: string[];
  columns: ColumnDef[];
  fields: FieldDef[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  actAs?: boolean; // rows have a user_id the admin can "act as"
}

export const ADMIN_TABLES: TableDef[] = [
  {
    key: 'candidates',
    label: 'Candidates',
    description: 'Creates the login (users) + profile (candidates) + resume embedding in one transaction. Deleting removes the user account (ON DELETE CASCADE).',
    pk: ['candidate_id'],
    columns: [
      { name: 'candidate_id', label: 'ID' },
      { name: 'full_name', label: 'Name' },
      { name: 'email', label: 'Email' },
      { name: 'location', label: 'Location' },
      { name: 'years_experience', label: 'Exp (yrs)' },
      { name: 'skill_count', label: 'Skills' },
      { name: 'application_count', label: 'Applications' },
    ],
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true, createOnly: true },
      { name: 'password', label: 'Password (min 6 chars)', type: 'password', required: true, createOnly: true },
      { name: 'full_name', label: 'Full name', type: 'text', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'education', label: 'Education', type: 'text' },
      { name: 'years_experience', label: 'Years of experience', type: 'number' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'resume_text', label: 'Resume text', type: 'textarea', required: true },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    actAs: true,
  },
  {
    key: 'recruiters',
    label: 'Recruiters',
    description: 'Creates the login (users) + recruiter profile linked to a company. A recruiter who still has jobs cannot be deleted (foreign key from jobs).',
    pk: ['recruiter_id'],
    columns: [
      { name: 'recruiter_id', label: 'ID' },
      { name: 'full_name', label: 'Name' },
      { name: 'email', label: 'Email' },
      { name: 'company_name', label: 'Company' },
      { name: 'designation', label: 'Designation' },
      { name: 'job_count', label: 'Jobs' },
    ],
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true, createOnly: true },
      { name: 'password', label: 'Password (min 6 chars)', type: 'password', required: true, createOnly: true },
      { name: 'full_name', label: 'Full name', type: 'text', required: true },
      { name: 'company_id', label: 'Company', type: 'ref', ref: 'companies', required: true },
      { name: 'designation', label: 'Designation', type: 'text' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    actAs: true,
  },
  {
    key: 'jobs',
    label: 'Jobs',
    description: 'Company is taken from the chosen recruiter. The job embedding is (re)generated on save. Trigger trg_job_deadline rejects past deadlines.',
    pk: ['job_id'],
    columns: [
      { name: 'job_id', label: 'ID' },
      { name: 'title', label: 'Title' },
      { name: 'company_name', label: 'Company' },
      { name: 'recruiter_name', label: 'Recruiter' },
      { name: 'salary_range', label: 'Salary' },
      { name: 'deadline', label: 'Deadline' },
      { name: 'status', label: 'Status' },
      { name: 'application_count', label: 'Applications' },
    ],
    fields: [
      { name: 'recruiter_id', label: 'Recruiter', type: 'ref', ref: 'recruiters', required: true, createOnly: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'salary_min', label: 'Salary min', type: 'number' },
      { name: 'salary_max', label: 'Salary max', type: 'number' },
      { name: 'openings', label: 'Openings', type: 'number' },
      { name: 'deadline', label: 'Deadline', type: 'date', required: true },
      { name: 'status', label: 'Status', type: 'enum', options: ['open', 'closed'], required: true },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    key: 'applications',
    label: 'Applications',
    description: 'New applications go through the apply_to_job() procedure (checks + score + first history row). Status changes fire trg_status_history.',
    pk: ['application_id'],
    columns: [
      { name: 'application_id', label: 'ID' },
      { name: 'candidate_name', label: 'Candidate' },
      { name: 'job_title', label: 'Job' },
      { name: 'status', label: 'Status' },
      { name: 'match_score', label: 'Match %' },
      { name: 'applied_at', label: 'Applied' },
    ],
    fields: [
      { name: 'candidate_id', label: 'Candidate', type: 'ref', ref: 'candidates', required: true, createOnly: true },
      { name: 'job_id', label: 'Job', type: 'ref', ref: 'jobs', required: true, createOnly: true },
      { name: 'status', label: 'Status', type: 'enum', options: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'], required: true, editOnly: true },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    key: 'candidate_skills',
    label: 'Candidate Skills',
    description: 'M:N junction table between candidates and skills (proficiency 1 to 5).',
    pk: ['candidate_id', 'skill_id'],
    columns: [
      { name: 'candidate_name', label: 'Candidate' },
      { name: 'skill_name', label: 'Skill' },
      { name: 'proficiency', label: 'Proficiency' },
      { name: 'years_used', label: 'Years used' },
    ],
    fields: [
      { name: 'candidate_id', label: 'Candidate', type: 'ref', ref: 'candidates', required: true, createOnly: true },
      { name: 'skill_id', label: 'Skill', type: 'ref', ref: 'skills', required: true, createOnly: true },
      { name: 'proficiency', label: 'Proficiency (1-5)', type: 'number', required: true },
      { name: 'years_used', label: 'Years used', type: 'number' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    key: 'job_skills',
    label: 'Job Skills',
    description: 'M:N junction table between jobs and skills (weight 1 to 5, mandatory flag).',
    pk: ['job_id', 'skill_id'],
    columns: [
      { name: 'job_title', label: 'Job' },
      { name: 'skill_name', label: 'Skill' },
      { name: 'weight', label: 'Weight' },
      { name: 'is_mandatory', label: 'Mandatory' },
    ],
    fields: [
      { name: 'job_id', label: 'Job', type: 'ref', ref: 'jobs', required: true, createOnly: true },
      { name: 'skill_id', label: 'Skill', type: 'ref', ref: 'skills', required: true, createOnly: true },
      { name: 'weight', label: 'Weight (1-5)', type: 'number', required: true },
      { name: 'is_mandatory', label: 'Mandatory', type: 'boolean' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    key: 'companies',
    label: 'Companies',
    description: 'A company that still has recruiters cannot be deleted (ON DELETE RESTRICT).',
    pk: ['company_id'],
    columns: [
      { name: 'company_id', label: 'ID' },
      { name: 'name', label: 'Name' },
      { name: 'industry', label: 'Industry' },
      { name: 'location', label: 'Location' },
      { name: 'website', label: 'Website' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'industry', label: 'Industry', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'website', label: 'Website', type: 'text' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    key: 'skills',
    label: 'Skills',
    description: 'The skill catalogue used by candidates and job requirements.',
    pk: ['skill_id'],
    columns: [
      { name: 'skill_id', label: 'ID' },
      { name: 'name', label: 'Name' },
      { name: 'category', label: 'Category' },
    ],
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'text', required: true },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
  {
    key: 'users',
    label: 'Users',
    description: 'All login accounts. New accounts created here are admins (candidates and recruiters are created in their own tabs). Leave password blank when editing to keep it.',
    pk: ['user_id'],
    columns: [
      { name: 'user_id', label: 'ID' },
      { name: 'email', label: 'Email' },
      { name: 'role', label: 'Role' },
      { name: 'display_name', label: 'Name' },
      { name: 'created_at', label: 'Created' },
    ],
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password' },
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    actAs: true,
  },
  {
    key: 'history',
    label: 'Status History',
    description: 'Audit trail written automatically by trigger trg_status_history (read-only).',
    pk: ['history_id'],
    columns: [
      { name: 'history_id', label: 'ID' },
      { name: 'application_id', label: 'App' },
      { name: 'candidate_name', label: 'Candidate' },
      { name: 'job_title', label: 'Job' },
      { name: 'old_status', label: 'From' },
      { name: 'new_status', label: 'To' },
      { name: 'changed_at', label: 'Changed' },
    ],
    fields: [],
    canCreate: false,
    canEdit: false,
    canDelete: false,
  },
];

export function getTableDef(key: string): TableDef | undefined {
  return ADMIN_TABLES.find((t) => t.key === key);
}
