'use client';

import React from 'react';
import { RequireRole } from '../../../../lib/roles';
import {
  Loading,
  Empty,
  Error as ErrorState,
  Forbidden,
} from '../../../../components/states';
import { getApiClient, ApiClientError } from '../../../../lib/api-client';

interface Setting {
  id: string;
  key: string;
  scope: 'global' | 'merchant';
  merchant_id: string | null;
  value: unknown;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ready'; settings: Setting[] }
  | { kind: 'empty' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

export default function FinanceSamplePage(): React.JSX.Element {
  const [state, setState] = React.useState<FetchState>({ kind: 'loading' });

  const load = React.useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const api = getApiClient();
      const response = await api.getList<Setting>(
        '/api/v1/settings?scope=global&page=1&page_size=20',
      );
      if (response.data.length === 0) {
        setState({ kind: 'empty' });
      } else {
        setState({ kind: 'ready', settings: response.data });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setState({ kind: 'forbidden' });
          return;
        }
        setState({
          kind: 'error',
          message: err.body?.error?.message ?? 'Unknown error',
        });
        return;
      }
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <RequireRole required="finance_admin">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Finance — Settings</h1>

        {state.kind === 'loading' && <Loading message="Loading settings..." />}

        {state.kind === 'empty' && (
          <Empty
            title="No settings"
            description="No global settings have been configured yet."
          />
        )}

        {state.kind === 'forbidden' && <Forbidden />}

        {state.kind === 'error' && (
          <ErrorState
            title="Unable to load"
            message={state.message}
            onRetry={() => void load()}
          />
        )}

        {state.kind === 'ready' && (
          <ul className="divide-y rounded border">
            {state.settings.map((setting) => (
              <li key={setting.id} className="p-4">
                <div className="font-mono text-sm">{setting.key}</div>
                <div className="text-xs text-muted-foreground">
                  scope: {setting.scope}
                  {setting.is_secret ? ' · (redacted)' : ''}
                </div>
                {!setting.is_secret && (
                  <pre className="mt-2 overflow-x-auto text-xs">
                    {JSON.stringify(setting.value, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </RequireRole>
  );
}
