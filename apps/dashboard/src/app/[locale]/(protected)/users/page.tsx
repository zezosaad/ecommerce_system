'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getApiClient, ApiClientError } from '@/lib/api-client';
import { createUsersClient, createRolesClient } from '@vendorhub/api-client';
import { Loading } from '@/components/states/Loading';
import type { UserProfileDto, RoleDto } from '@vendorhub/types';

interface UserWithRoles extends UserProfileDto {
  roles: RoleDto[];
}

export default function UsersPage(): React.JSX.Element {
  const t = useTranslations();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      const usersClient = createUsersClient(client);
      const rolesClient = createRolesClient(client);

      const params: {
        page?: number; pageSize?: number; q?: string;
        status?: string; roleKey?: string;
      } = { page, pageSize: 20 };
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.roleKey = roleFilter;

      const [usersRes, rolesRes] = await Promise.all([
        usersClient.list(params),
        rolesClient.list(),
      ]);
      setUsers(usersRes.data as UserWithRoles[]);
      setRoles(rolesRes.data);
      setTotalPages(usersRes.pagination?.total_pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, roleFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openUserDetail(user: UserWithRoles) {
    setSelectedUser(user);
    setSelectedRoleIds(user.roles.map((r) => r.id));
    setNewStatus('');
    setStatusReason('');
  }

  async function handleUpdateStatus() {
    if (!selectedUser || !newStatus) return;
    setUpdating(true);
    setError(null);
    try {
      const client = getApiClient();
      const usersClient = createUsersClient(client);
      await usersClient.updateStatus(selectedUser.id, {
        status: newStatus,
        reason: statusReason || undefined,
      });
      setNewStatus('');
      setStatusReason('');
      await loadData();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateRoles() {
    if (!selectedUser) return;
    setUpdating(true);
    setError(null);
    try {
      const client = getApiClient();
      const usersClient = createUsersClient(client);
      await usersClient.updateRoles(selectedUser.id, {
        roleIds: selectedRoleIds,
      });
      await loadData();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update roles');
    } finally {
      setUpdating(false);
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    suspended: 'bg-red-100 text-red-700',
    pending_verification: 'bg-yellow-100 text-yellow-700',
    deleted: 'bg-gray-100 text-gray-400',
  };

  if (loading && users.length === 0) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('auth.sidebar.users')}</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('common.search')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="pending_verification">Pending</option>
          <option value="deleted">Deleted</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.key}>{role.label.en}</option>
          ))}
        </select>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Roles</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[user.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span key={role.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {role.label.en}
                      </span>
                    ))}
                    {user.roles.length === 0 && (
                      <span className="text-xs text-gray-400">No roles</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openUserDetail(user)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-20 z-50" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedUser.firstName
                  ? `${selectedUser.firstName} ${selectedUser.lastName}`
                  : selectedUser.email}
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[selectedUser.status]}`}>
                  {selectedUser.status}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Update Status</h3>
                <div className="flex gap-2 mb-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1"
                  >
                    <option value="">Select status...</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={!newStatus || updating}
                    className="px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
                <input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Roles</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="rounded border-gray-300"
                      />
                      <span>{role.label.en}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-400">{role.label.ar}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleUpdateRoles}
                  disabled={updating}
                  className="mt-3 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Roles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
