'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Plus, Pencil, Trash2, UserCog, X, RefreshCw, Database, Users, Briefcase, FileText } from 'lucide-react';
import { ADMIN_TABLES, TableDef, FieldDef } from '@/lib/adminTables';

type Row = Record<string, any>;
type Refs = Record<string, { value: number; label: string }[]>;

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-slate-100 text-slate-700',
  screening: 'bg-blue-100 text-blue-800',
  interview: 'bg-indigo-100 text-indigo-800',
  offer: 'bg-amber-100 text-amber-800',
  hired: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  open: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
  admin: 'bg-amber-100 text-amber-800',
  candidate: 'bg-indigo-100 text-indigo-800',
  recruiter: 'bg-violet-100 text-violet-800',
};

function formatCell(name: string, value: any) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-300">—</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (['status', 'role', 'old_status', 'new_status'].includes(name) && STATUS_COLORS[value]) {
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_COLORS[value]}`}>{value}</span>;
  }
  return String(value);
}

export default function AdminConsolePage() {
  const router = useRouter();
  const [tab, setTab] = useState<string>('overview');
  const [stats, setStats] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [refs, setRefs] = useState<Refs>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; data: Row; pk?: Row } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actAsLists, setActAsLists] = useState<{ candidates: Row[]; recruiters: Row[] }>({ candidates: [], recruiters: [] });

  const def: TableDef | undefined = useMemo(() => ADMIN_TABLES.find((t) => t.key === tab), [tab]);

  const loadStats = useCallback(async () => {
    const [s, c, r] = await Promise.all([
      fetch('/api/admin/stats').then((res) => res.json()),
      fetch('/api/admin/candidates').then((res) => res.json()),
      fetch('/api/admin/recruiters').then((res) => res.json()),
    ]);
    setStats(s);
    setActAsLists({ candidates: c.rows || [], recruiters: r.rows || [] });
  }, []);

  const loadTable = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/${key}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRows(data.rows || []);
      setRefs(data.refs || {});
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setForm(null);
    if (tab === 'overview') {
      loadStats().catch(() => setMessage({ type: 'error', text: 'Failed to load stats' }));
    } else {
      loadTable(tab);
    }
  }, [tab, loadStats, loadTable]);

  const actAs = async (userId: number) => {
    const res = await fetch('/api/admin/act-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Could not switch user' });
      return;
    }
    router.push(data.user.role === 'recruiter' ? '/recruiter/dashboard' : '/matches');
    router.refresh();
  };

  const openCreate = () => {
    if (!def) return;
    const data: Row = {};
    def.fields.forEach((f) => {
      if (f.editOnly) return;
      data[f.name] = f.type === 'boolean' ? false : f.type === 'enum' && f.options ? f.options[0] : '';
    });
    setForm({ mode: 'create', data });
    setMessage(null);
  };

  const openEdit = (row: Row) => {
    if (!def) return;
    const data: Row = {};
    def.fields.forEach((f) => {
      if (f.createOnly) return;
      data[f.name] = f.type === 'password' ? '' : row[f.name] ?? (f.type === 'boolean' ? false : '');
    });
    const pk: Row = {};
    def.pk.forEach((k) => (pk[k] = row[k]));
    setForm({ mode: 'edit', data, pk });
    setMessage(null);
  };

  const save = async () => {
    if (!def || !form) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/${def.key}`, {
        method: form.mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: form.data, pk: form.pk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage({ type: 'ok', text: form.mode === 'create' ? `${def.label}: new row created.` : `${def.label}: row updated.` });
      setForm(null);
      loadTable(def.key);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!def) return;
    const label = row.full_name || row.title || row.name || row.email || row.candidate_name || `#${row[def.pk[0]]}`;
    if (!confirm(`Delete ${label} from ${def.label}? This cannot be undone.`)) return;
    const pk: Row = {};
    def.pk.forEach((k) => (pk[k] = row[k]));
    const res = await fetch(`/api/admin/${def.key}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pk }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Delete failed' });
      return;
    }
    setMessage({ type: 'ok', text: `${def.label}: row deleted.` });
    loadTable(def.key);
  };

  const renderField = (f: FieldDef) => {
    if (!form) return null;
    if (form.mode === 'create' && f.editOnly) return null;
    if (form.mode === 'edit' && f.createOnly) return null;
    const value = form.data[f.name];
    const set = (v: any) => setForm({ ...form, data: { ...form.data, [f.name]: v } });
    const base = 'w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400';
    let input: React.ReactNode;
    if (f.type === 'textarea') {
      input = <textarea rows={3} value={value ?? ''} onChange={(e) => set(e.target.value)} className={base} />;
    } else if (f.type === 'boolean') {
      input = (
        <label className="flex items-center space-x-2 text-sm">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
          <span>{value ? 'Yes' : 'No'}</span>
        </label>
      );
    } else if (f.type === 'enum') {
      input = (
        <select value={value ?? ''} onChange={(e) => set(e.target.value)} className={base}>
          {(f.options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    } else if (f.type === 'ref') {
      input = (
        <select value={value ?? ''} onChange={(e) => set(e.target.value)} className={base}>
          <option value="">Select…</option>
          {(refs[f.ref || ''] || []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    } else {
      const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text';
      input = (
        <input
          type={type}
          value={value ?? ''}
          step={f.type === 'number' ? 'any' : undefined}
          placeholder={f.type === 'password' && form.mode === 'edit' ? 'Leave blank to keep current password' : ''}
          onChange={(e) => set(e.target.value)}
          className={base}
        />
      );
    }
    return (
      <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          {f.label} {f.required && <span className="text-rose-500">*</span>}
        </label>
        {input}
      </div>
    );
  };

  const statCards = stats?.counts
    ? [
        { label: 'Users', value: stats.counts.users, sub: `${stats.counts.admins} admin(s)`, icon: Users },
        { label: 'Candidates', value: stats.counts.candidates, sub: 'profiles', icon: Users },
        { label: 'Recruiters', value: stats.counts.recruiters, sub: `${stats.counts.companies} companies`, icon: Briefcase },
        { label: 'Jobs', value: stats.counts.jobs, sub: `${stats.counts.open_jobs} open`, icon: Briefcase },
        { label: 'Applications', value: stats.counts.applications, sub: `${stats.counts.history_rows} history rows`, icon: FileText },
        { label: 'Vectors', value: stats.counts.vectors, sub: 'resume + job embeddings', icon: Database },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl">
        <span className="text-xs font-bold tracking-wider uppercase text-amber-200">Admin Role • Full CRUD • admin_role in PostgreSQL</span>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1 flex items-center space-x-2">
          <ShieldCheck className="w-8 h-8" />
          <span>Admin Console</span>
        </h1>
        <p className="text-amber-100/90 text-sm mt-1">
          Create, read, update and delete every table, or act as any candidate or recruiter to use their pages.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[{ key: 'overview', label: 'Overview' }, ...ADMIN_TABLES.map((t) => ({ key: t.key, label: t.label }))].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setMessage(null);
              setTab(t.key);
            }}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition border ${
              tab === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border flex items-start justify-between gap-3 ${
            message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{message.type === 'error' ? 'Database said: ' : ''}{message.text}</span>
          <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {statCards.map((c) => (
              <div key={c.label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Applications by status (whole platform)</h2>
              <div className="space-y-2">
                {(stats?.applicationsByStatus || []).map((s: any) => (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    {formatCell('status', s.status)}
                    <span className="font-bold text-slate-800">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Act as a candidate or recruiter</h2>
              <p className="text-xs text-slate-500">
                Switch into any account to use the candidate pages (matches, apply, profile, applications) or recruiter pages
                (post jobs, ranked applicants, status changes, funnel). Use “Back to Admin” in the top bar to return.
              </p>
              <ActAsPicker
                label="Candidate"
                options={actAsLists.candidates.map((c) => ({ value: c.user_id, label: `${c.full_name} (${c.email})` }))}
                onGo={actAs}
              />
              <ActAsPicker
                label="Recruiter"
                options={actAsLists.recruiters.map((r) => ({ value: r.user_id, label: `${r.full_name} (${r.company_name})` }))}
                onGo={actAs}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table tabs */}
      {def && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {def.label} <span className="text-sm font-medium text-slate-400">({rows.length} rows)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">{def.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadTable(def.key)}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {def.canCreate && (
                <button
                  onClick={openCreate}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add {def.label.replace(/s$/, '')}</span>
                </button>
              )}
            </div>
          </div>

          {form && (
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">
                  {form.mode === 'create' ? `New ${def.label.replace(/s$/, '')}` : `Edit ${def.label.replace(/s$/, '')}`}
                </h3>
                <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">{def.fields.map(renderField)}</div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
                >
                  {saving ? 'Saving…' : form.mode === 'create' ? 'Create' : 'Save changes'}
                </button>
                <button onClick={() => setForm(null)} className="px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    {def.columns.map((c) => (
                      <th key={c.name} className="px-4 py-3 font-semibold whitespace-nowrap">{c.label}</th>
                    ))}
                    {(def.canEdit || def.canDelete || def.actAs) && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={def.pk.map((k) => row[k]).join('-')} className="hover:bg-slate-50/60">
                      {def.columns.map((c) => (
                        <td key={c.name} className="px-4 py-2.5 text-slate-700 max-w-[260px] truncate">{formatCell(c.name, row[c.name])}</td>
                      ))}
                      {(def.canEdit || def.canDelete || def.actAs) && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {def.actAs && row.user_id && row.role !== 'admin' && (
                            <button
                              onClick={() => actAs(row.user_id)}
                              title="Act as this user"
                              className="inline-flex items-center space-x-1 px-2 py-1 mr-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                            >
                              <UserCog className="w-3.5 h-3.5" />
                              <span>Act as</span>
                            </button>
                          )}
                          {def.canEdit && (
                            <button onClick={() => openEdit(row)} title="Edit" className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {def.canDelete && (
                            <button onClick={() => remove(row)} title="Delete" className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActAsPicker({
  label,
  options,
  onGo,
}: {
  label: string;
  options: { value: number; label: string }[];
  onGo: (userId: number) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs font-bold text-slate-500 uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 text-sm bg-white border border-slate-300 rounded-lg px-3 py-2"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        disabled={!value}
        onClick={() => onGo(Number(value))}
        className="px-3 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg"
      >
        Act as
      </button>
    </div>
  );
}
