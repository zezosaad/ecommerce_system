'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { getApiClient, ApiClientError } from '@/lib/api-client';
import { createRolesClient, createPermissionsClient } from '@vendorhub/api-client';
import { Loading } from '@/components/states/Loading';
import { Error } from '@/components/states/Error';
import type { RoleDto, PermissionDto } from '@vendorhub/types';

interface PermissionGroup {
  module: string;
  label: { en: string; ar: string };
  resources: Array<{
    resource: string;
    label: { en: string; ar: string };
    permissions: PermissionDto[];
  }>;
}

export default function RoleDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string; locale: string }>();
  const router = useRouter();

  const [role, setRole] = useState<RoleDto | null>(null);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');

  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      const rolesClient = createRolesClient(client);
      const permissionsClient = createPermissionsClient(client);
      const [roleRes, permGrouped] = await Promise.all([
        rolesClient.getById(params.id),
        permissionsClient.grouped(),
      ]);
      const r = roleRes.data;
      setRole(r);
      setLabelEn(r.label.en);
      setLabelAr(r.label.ar);
      setDescEn(r.description?.en ?? '');
      setDescAr(r.description?.ar ?? '');
      setPermissionGroups(permGrouped.data as unknown as PermissionGroup[]);
      // Seed selection from the role's currently-assigned permissions so the
      // editor reflects state instead of always starting empty.
      const currentPerms = (r as { permissions?: Array<{ key: string }> })
        .permissions;
      if (Array.isArray(currentPerms)) {
        setSelectedPermissionKeys(new Set(currentPerms.map((p) => p.key)));
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load role');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const client = getApiClient();
      const rolesClient = createRolesClient(client);
      const isSuperAdmin = role?.key === 'super_admin';
      await rolesClient.update(params.id, {
        label: { en: labelEn, ar: labelAr },
        description: descEn || descAr ? { en: descEn, ar: descAr } : null,
        // Permissions cannot be edited on the super_admin role (the backend
        // also enforces this and returns 403). Skip the field for
        // super_admin so an unchanged form doesn't trigger that error.
        ...(isSuperAdmin
          ? {}
          : { permissions: Array.from(selectedPermissionKeys) }),
      });
      router.push(`/${params.locale}/roles`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(key: string) {
    setSelectedPermissionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return <Loading />;
  if (error) return <Error message={error} onRetry={loadData} />;
  if (!role) return <Error message="Role not found" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/${params.locale}/roles`)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {role.label.en}
        </h1>
        {role.isSystem && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">System</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-xl">
        <div className="p-4 border border-gray-200 rounded-lg space-y-4">
          <h2 className="font-semibold text-gray-900">Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label (EN)</label>
              <input
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                required
                disabled={role.isSystem}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label (AR)</label>
              <input
                value={labelAr}
                onChange={(e) => setLabelAr(e.target.value)}
                required
                disabled={role.isSystem}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (EN)</label>
              <input
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                disabled={role.isSystem}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (AR)</label>
              <input
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                disabled={role.isSystem}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg space-y-4">
          <h2 className="font-semibold text-gray-900">Permissions</h2>
          {permissionGroups.map((group) => (
            <details key={group.module} className="group">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                {group.label.en} / {group.label.ar}
              </summary>
              <div className="mt-2 ml-4 space-y-2">
                {group.resources.map((resource) => (
                  <div key={resource.resource}>
                    <p className="text-xs text-gray-500 font-medium mb-1">
                      {resource.label.en}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {resource.permissions.map((perm) => (
                        <label
                          key={perm.key}
                          className="flex items-center gap-1.5 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissionKeys.has(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            disabled={role.isSystem && role.key === 'super_admin'}
                            className="rounded border-gray-300"
                          />
                          <span>{perm.action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || role.isSystem}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${params.locale}/roles`)}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
