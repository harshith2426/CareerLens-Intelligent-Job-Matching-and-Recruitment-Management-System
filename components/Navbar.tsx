'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, Sparkles, User, FileText, LayoutDashboard, PlusCircle, LogOut, LogIn, ChevronRight, CheckCircle2, ShieldCheck, Undo2 } from 'lucide-react';

interface UserSession {
  userId: number;
  email: string;
  role: 'candidate' | 'recruiter' | 'admin';
  fullName: string;
  adminUserId?: number;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  const isCandidate = user?.role === 'candidate';
  const isRecruiter = user?.role === 'recruiter';
  const isAdmin = user?.role === 'admin';
  const isActingAs = !!user?.adminUserId;

  const handleBackToAdmin = async () => {
    const res = await fetch('/api/admin/act-as', { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      {isActingAs && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3">
            <span>
              <strong>Admin mode:</strong> you are acting as <strong>{user?.fullName}</strong> ({user?.role}). Everything you do is done as this user.
            </span>
            <button
              onClick={handleBackToAdmin}
              className="flex items-center space-x-1 font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Back to Admin</span>
            </button>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Tag */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Career<span className="text-indigo-600">Lens</span>
              </span>
            </Link>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Level 3 DBMS
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/jobs"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === '/jobs' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              }`}
            >
              Explore Jobs
            </Link>

            {isCandidate && (
              <>
                <Link
                  href="/matches"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname === '/matches' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>AI Matches</span>
                </Link>
                <Link
                  href="/applications"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname === '/applications' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Applications</span>
                </Link>
                <Link
                  href="/profile"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname === '/profile' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Profile & Skills</span>
                </Link>
              </>
            )}

            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  pathname === '/admin' ? 'bg-amber-50 text-amber-800 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Admin Console</span>
              </Link>
            )}

            {isRecruiter && (
              <>
                <Link
                  href="/recruiter/dashboard"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname === '/recruiter/dashboard' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Funnel Dashboard</span>
                </Link>
                <Link
                  href="/recruiter/jobs"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname === '/recruiter/jobs' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Manage Postings</span>
                </Link>
              </>
            )}
          </nav>

          {/* User Status / Auth Actions */}
          <div className="flex items-center space-x-3">
            {loading ? (
              <div className="w-24 h-8 bg-slate-100 rounded animate-pulse" />
            ) : user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-900 leading-tight">{user.fullName}</span>
                  <span className="text-xs font-medium text-indigo-600 capitalize">{user.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
