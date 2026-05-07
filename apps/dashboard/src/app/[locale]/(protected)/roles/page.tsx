'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient, ApiClientError } from '@/lib/api-client';
import { createRolesClient } from '@vendorhub/api-client';
import { Loading } from '@/components/states/Loading';
import { Error } from '@/components/states/Error';
import type { RoleDto } from '@vendorhub/types';

export default function RolesListPage(): React.JSX.Element {
  const router = useRouter();

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createKey, setCreateKey] = useState('');
  const [createLabelEn, setCreateLabelEn] = useState('');
  const [createLabelAr, setCreateLabelAr] = useState('');
  const [createDescEn, setCreateDescEn] = useState('');
  const [createDescAr, setCreateDescAr] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      const rolesClient = createRolesClient(client);
      const rolesRes = await rolesClient.list();
      setRoles(rolesRes.data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const client = getApiClient();
      const rolesClient = createRolesClient(client);
      await rolesClient.create({
        key: createKey,
        label: { en: createLabelEn, ar: createLabelAr },
        description: createDescEn || createDescAr
          ? { en: createDescEn, ar: createDescAr }
          : undefined,
      });
      setShowCreate(false);
      setCreateKey('');
      setCreateLabelEn('');
      setCreateLabelAr('');
      setCreateDescEn('');
      setCreateDescAr('');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create role');
    }
  }

  async function handleDelete(roleId: string) {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    setDeleting(roleId);
    try {
      const client = getApiClient();
      const rolesClient = createRolesClient(client);
      await rolesClient.delete(roleId);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete role');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <Error message={error} onRetry={loadData} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Create Role
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
          <h2 className="font-semibold text-gray-900">New Role</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
              <input
                value={createKey}
                onChange={(e) => setCreateKey(e.target.value)}
                placeholder="e.g. custom_role"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label (EN)</label>
                <input
                  value={createLabelEn}
                  onChange={(e) => setCreateLabelEn(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label (AR)</label>
                <input
                  value={createLabelAr}
                  onChange={(e) => setCreateLabelAr(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (EN)</label>
                <input
                  value={createDescEn}
                  onChange={(e) => setCreateDescEn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (AR)</label>
                <input
                  value={createDescAr}
                  onChange={(e) => setCreateDescAr(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Key</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Label</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">System</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-900">{role.key}</td>
                <td className="px-4 py-3 text-gray-900">
                  <span>{role.label.en}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span dir="rtl">{role.label.ar}</span>
                </td>
                <td className="px-4 py-3">
                  {role.isSystem
                    ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">System</span>
                    : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Custom</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => router.push(`/roles/${role.id}`)}
                    className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    disabled={role.isSystem || deleting === role.id}
                    className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting === role.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No roles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
