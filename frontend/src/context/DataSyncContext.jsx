import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DataSyncContext = createContext(null);

const initialVersions = {
  dashboard: 0,
  tenants: 0,
  buildings: 0,
  units: 0,
  contracts: 0,
  payments: 0,
  reports: 0,
  expenses: 0
};

export const DataSyncProvider = ({ children }) => {
  const [versions, setVersions] = useState(initialVersions);

  const notifyDataChanged = useCallback((keys = []) => {
    const normalizedKeys = Array.isArray(keys) ? [...new Set(keys)] : [];

    if (normalizedKeys.length === 0) return;

    setVersions((prev) => {
      const next = { ...prev };
      normalizedKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
          next[key] += 1;
        }
      });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ versions, notifyDataChanged }), [versions, notifyDataChanged]);

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
};

export const useDataSync = () => {
  const context = useContext(DataSyncContext);
  if (!context) {
    throw new Error('useDataSync must be used within DataSyncProvider');
  }
  return context;
};
