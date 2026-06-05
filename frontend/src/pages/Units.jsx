import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getReadableApiError, unitService, buildingService } from '../services/api';
import { useDataSync } from '../context/DataSyncContext';
import { FLOOR_OPTIONS, parseBuildingFloors } from '../utils/floorOptions';
import useFeedbackToast from '../hooks/useFeedbackToast';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.4" />
    <rect x="14" y="3" width="7" height="7" rx="1.4" />
    <rect x="3" y="14" width="7" height="7" rx="1.4" />
    <rect x="14" y="14" width="7" height="7" rx="1.4" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const formatCurrency = (value) =>
  `${parseFloat(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
const unitSorter = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const idsEqual = (first, second) => String(first || '') === String(second || '');
const getFloorSortValue = (floor = '') => {
  const normalized = String(floor || '').toUpperCase();
  if (normalized.startsWith('BASEMENT')) return -10 + parseInt(normalized.replace(/\D/g, '') || '0', 10);
  if (normalized === 'GROUND FLOOR' || normalized === 'GF') return 0;
  if (normalized === '1ST FLOOR' || normalized === '1F') return 1;
  if (normalized === '2ND FLOOR' || normalized === '2F') return 2;
  if (normalized === '3RD FLOOR' || normalized === '3F') return 3;
  if (normalized === 'CONT') return 900;
  return 500;
};

const Units = () => {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { versions, notifyDataChanged } = useDataSync();
  const [units, setUnits] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const canManageOperations = isManager();
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const [formData, setFormData] = useState({
    building_id: '',
    unit_number: '',
    unit_type: '',
    monthly_rent: '',
    status: 'available',
    floor: 'GROUND FLOOR'
  });

  useEffect(() => {
    fetchUnits();
    fetchBuildings();
  }, [versions.units, versions.buildings, versions.tenants]);

  const fetchUnits = async () => {
    try {
      const response = await unitService.getAll();
      setUnits(response.data);
    } catch (err) {
      setError('Failed to load units');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await buildingService.getAll();
      setBuildings(response.data);
    } catch (err) {
      console.error('Failed to load buildings');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSuccess('');

    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }
    if (!formData.building_id || !formData.unit_number.trim()) {
      setError('Building and unit number are required.');
      return;
    }
    const rent = parseFloat(formData.monthly_rent || 0);
    if (!Number.isFinite(rent) || rent < 0) {
      setError('Monthly rent must be a valid number.');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await unitService.update(editingId, formData);
        setSuccess('Unit updated successfully');
      } else {
        await unitService.create(formData);
        setSuccess('Unit created successfully');
      }

      notifyDataChanged(['units', 'tenants', 'dashboard', 'reports']);

      resetForm();
      fetchUnits();
    } catch (err) {
      setError(getReadableApiError(err, 'Failed to save unit'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (unit) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    setFormData({
      building_id: unit.building_id,
      unit_number: unit.unit_number,
      unit_type: unit.unit_type || '',
      monthly_rent: unit.monthly_rent || '',
      status: unit.status === 'maintenance' ? 'maintenance' : 'available',
      floor: unit.floor || 'GROUND FLOOR'
    });
    setEditingId(unit.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this unit?')) {
      try {
        setDeletingId(id);
        await unitService.delete(id);
        setSuccess('Unit deleted successfully');
        notifyDataChanged(['units', 'tenants', 'dashboard', 'reports']);
        fetchUnits();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete unit');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      unit_number: '',
      unit_type: '',
      monthly_rent: '',
      status: 'available',
      floor: 'GROUND FLOOR'
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'building_id') {
      const nextFloorOptions = getBuildingFloorOptions(value);
      const nextFloor = nextFloorOptions.includes(formData.floor)
        ? formData.floor
        : nextFloorOptions[0] || 'GROUND FLOOR';

      setFormData({ ...formData, building_id: value, floor: nextFloor });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const getBuildingFloorOptions = (buildingId) => {
    if (!buildingId) {
      return FLOOR_OPTIONS;
    }

    const selectedBuilding = buildings.find((building) => idsEqual(building.id, buildingId));
    const configuredFloors = parseBuildingFloors(selectedBuilding?.available_floors);

    return configuredFloors.length > 0 ? configuredFloors : FLOOR_OPTIONS;
  };

  // Filter units based on selected building and status
  const filteredUnits = units
    .filter((unit) => {
      const matchesBuilding = !selectedBuildingFilter || idsEqual(unit.building_id, selectedBuildingFilter);
      const matchesStatus = !selectedStatusFilter || unit.status === selectedStatusFilter;
      return matchesBuilding && matchesStatus;
    })
    .sort((firstUnit, secondUnit) => {
      const buildingComparison = String(firstUnit.building_name || '').localeCompare(String(secondUnit.building_name || ''));
      if (buildingComparison) return buildingComparison;

      const floorDifference = getFloorSortValue(firstUnit.floor) - getFloorSortValue(secondUnit.floor);
      if (floorDifference) return floorDifference;

      return unitSorter.compare(firstUnit.unit_number || '', secondUnit.unit_number || '');
    });
  const groupedUnitsByFloor = Object.values(
    filteredUnits.reduce((groups, unit) => {
      const buildingLabel = String(unit.building_name || 'No building assigned').trim().toUpperCase();
      const floorLabel = String(unit.floor || 'GROUND FLOOR').trim().toUpperCase();
      const groupKey = `${buildingLabel}__${floorLabel}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          buildingLabel,
          floorLabel,
          units: []
        };
      }

      groups[groupKey].units.push(unit);
      return groups;
    }, {})
  ).sort((firstGroup, secondGroup) => {
    const buildingComparison = firstGroup.buildingLabel.localeCompare(secondGroup.buildingLabel);
    if (buildingComparison) return buildingComparison;

    const floorDifference = getFloorSortValue(firstGroup.floorLabel) - getFloorSortValue(secondGroup.floorLabel);
    if (floorDifference) return floorDifference;

    return firstGroup.floorLabel.localeCompare(secondGroup.floorLabel);
  });

  const getSelectedBuildingName = () => {
    if (!selectedBuildingFilter) return 'All Buildings';
    const building = buildings.find((b) => idsEqual(b.id, selectedBuildingFilter));
    return building ? building.name : 'All Buildings';
  };

  if (loading) {
    return (
      <div className="units-page-shell" style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.loadingTitle}>Units / Rooms Management</div>
          <div style={styles.loadingText}>Loading unit availability, rent, and building assignment records...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="units-page-shell" style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIntro}>
          <div style={styles.eyebrowPill}>Property Inventory</div>
          <h1 style={styles.title}>Units / Rooms Management</h1>
          <p style={styles.subtitle}>Track unit availability, assignments, and building filters clearly.</p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.btnSecondary}
            onClick={() => navigate('/monthly-rent-sheet')}
          >
            <span style={styles.buttonInner}>
              <GridIcon />
              <span>Rent Collection Sheet</span>
            </span>
          </button>
          <button
            type="button"
            style={{ ...styles.btnPrimary, ...(!canManageOperations ? styles.btnDisabled : {}) }}
            onClick={() => setShowForm(!showForm)}
            disabled={!canManageOperations}
          >
            <span style={styles.buttonInner}>
              <PlusIcon />
              <span>{showForm ? 'Cancel' : 'Add Unit'}</span>
            </span>
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {!canManageOperations ? (
        <div style={styles.readOnlyBanner}>
          You have view-only access here. Unit records can be reviewed, but adding, editing, and deleting units is limited to managers and admins.
        </div>
      ) : null}

      {/* Filters Section */}
      <div style={styles.filterCard}>
        <h3 style={styles.filterTitle}>Filter Units</h3>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Building / House:</label>
            <select
              style={styles.filterSelect}
              value={selectedBuildingFilter}
              onChange={(e) => setSelectedBuildingFilter(e.target.value)}
            >
              <option value="">All Buildings</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Status:</label>
            <select
              style={styles.filterSelect}
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Results:</label>
            <div style={styles.filterInfo}>
              <strong>{filteredUnits.length}</strong> unit(s) in {getSelectedBuildingName()}
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>
            {editingId ? 'Edit Unit' : 'Add New Unit'}
          </h2>
          <form onSubmit={handleSubmit}>
            <fieldset style={styles.formFieldset} disabled={!canManageOperations}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label>Building *</label>
                <select
                  name="building_id"
                  value={formData.building_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a building</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Unit Number *</label>
                <input
                  type="text"
                  name="unit_number"
                  value={formData.unit_number}
                  onChange={handleInputChange}
                  placeholder="e.g., Room 101, Shop A"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label>Unit Type</label>
                <select
                  name="unit_type"
                  value={formData.unit_type}
                  onChange={handleInputChange}
                >
                  <option value="">Select type</option>
                  <option value="shop">Shop</option>
                  <option value="office">Office</option>
                  <option value="apartment">Apartment</option>
                  <option value="room">Room</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Monthly Rent</label>
                <input
                  type="number"
                  name="monthly_rent"
                  value={formData.monthly_rent}
                  onChange={handleInputChange}
                  step="0.01"
                />
              </div>

              <div style={styles.formGroup}>
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                </select>
                <small style={styles.fieldHelp}>
                  Occupied status is automatic from active tenant assignment.
                </small>
              </div>

              <div style={styles.formGroup}>
                <label>Floor</label>
                <select
                  name="floor"
                  value={formData.floor}
                  onChange={handleInputChange}
                >
                  {getBuildingFloorOptions(formData.building_id).map((floorLabel) => (
                    <option key={floorLabel} value={floorLabel}>{floorLabel}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.formActions}>
              <button
                type="submit"
                style={{ ...styles.btnPrimary, ...(!canManageOperations || saving ? styles.btnDisabled : {}) }}
                disabled={!canManageOperations || saving}
              >
                {!canManageOperations ? 'View Only' : saving ? 'Saving...' : editingId ? 'Update Unit' : 'Create Unit'}
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      )}

      {/* Units Table */}
      <div style={styles.tableCard}>
        {filteredUnits.length > 0 ? (
          <div>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Unit Number</th>
                  <th style={styles.th}>Building</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Monthly Rent</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Floor</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedUnitsByFloor.map((group) => {
                  const occupiedCount = group.units.filter((unit) => unit.status === 'occupied').length;
                  const unitNames = group.units.map((unit) => unit.unit_number).filter(Boolean);
                  const visibleUnitNames = unitNames.slice(0, 8).join(', ');
                  const hiddenUnitCount = Math.max(unitNames.length - 8, 0);

                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr>
                        <td colSpan={7} style={styles.floorGroupCell}>
                          <div style={styles.floorGroupContent}>
                            <div style={styles.floorGroupMain}>
                              <span style={styles.floorGroupTitle}>
                                <span style={styles.floorGroupBuilding}>{group.buildingLabel}</span>
                                <span style={styles.floorGroupSeparator}>-</span>
                                <span>{group.floorLabel}</span>
                              </span>
                              <span style={styles.floorGroupUnitList}>
                                {visibleUnitNames || 'No unit names'}{hiddenUnitCount > 0 ? `, +${hiddenUnitCount} more` : ''}
                              </span>
                            </div>
                            <div style={styles.floorGroupStats}>
                              <span style={styles.floorGroupCount}>{group.units.length} unit{group.units.length === 1 ? '' : 's'} on this floor</span>
                              <span style={styles.floorGroupTenantCount}>{occupiedCount} tenant{occupiedCount === 1 ? '' : 's'} on this floor</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.units.map((unit) => (
                  <tr key={unit.id} style={styles.tableRow}>
                    <td style={styles.td}>
                      <span style={styles.unitPill}>{unit.unit_number}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.primaryCellText}>{unit.building_name}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.typeTag}>{unit.unit_type || 'N/A'}</span>
                    </td>
                    <td style={styles.td}>
                      <strong>{formatCurrency(unit.monthly_rent)}</strong>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor:
                            unit.status === 'occupied'
                              ? '#d1fae5'
                              : unit.status === 'available'
                              ? '#dbeafe'
                              : '#fef3c7',
                          color:
                            unit.status === 'occupied'
                              ? '#065f46'
                              : unit.status === 'available'
                              ? '#1e40af'
                              : '#92400e'
                        }}
                      >
                        {unit.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.floorPill}>{unit.floor || 'GROUND FLOOR'}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <button
                          type="button"
                          style={{ ...styles.btnSmall, ...styles.btnEdit, ...(!canManageOperations ? styles.btnDisabled : {}) }}
                          onClick={() => handleEdit(unit)}
                          title="Edit unit"
                          disabled={!canManageOperations}
                        >
                          <span style={styles.buttonInner}>
                            <EditIcon />
                            <span>Edit</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          style={{ ...styles.btnSmall, ...styles.btnDanger, ...(!canManageOperations || deletingId === unit.id ? styles.btnDisabled : {}) }}
                          onClick={() => handleDelete(unit.id)}
                          title="Delete unit"
                          disabled={!canManageOperations || deletingId === unit.id}
                        >
                          <span style={styles.buttonInner}>
                            <TrashIcon />
                            <span>{deletingId === unit.id ? 'Deleting...' : 'Delete'}</span>
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.noData}>
            <p>No units found</p>
            {selectedBuildingFilter && <p style={styles.noDataSmall}>Try selecting a different building or status</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '1rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  headerIntro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    maxWidth: '680px'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    color: '#0f172a',
    backgroundColor: '#ccfbf1',
    border: '1px solid rgba(255, 255, 255, 0.45)',
    borderRadius: '999px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.76rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.14)'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '900',
    color: '#ffffff',
    margin: 0,
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    margin: 0,
    color: '#dbeafe',
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: 1.55,
    maxWidth: '58ch'
  },
  btnPrimary: {
    padding: '0.9rem 1.2rem',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    transition: 'background-color 0.3s ease',
    boxShadow: '0 14px 26px rgba(37, 99, 235, 0.22)'
  },
  btnSecondary: {
    padding: '0.85rem 1.2rem',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '800',
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.16)',
    backdropFilter: 'blur(10px)'
  },
  btnSmall: {
    padding: '0.58rem 0.85rem',
    backgroundColor: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '0.8rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    transition: 'background-color 0.2s ease',
    whiteSpace: 'nowrap'
  },
  btnEdit: {
    backgroundColor: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1'
  },
  btnDanger: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca'
  },
  buttonInner: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '1rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '1rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem'
  },
  readOnlyBanner: {
    background: '#f8fafc',
    color: '#334155',
    padding: '1rem',
    borderRadius: '0.75rem',
    marginBottom: '1rem',
    border: '1px solid #cbd5e1',
    fontWeight: 600,
    lineHeight: 1.5
  },
  loading: {
    textAlign: 'center',
    padding: '2.25rem',
    borderRadius: '0.9rem',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid #dbe4f0',
    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.09)'
  },
  loadingTitle: {
    color: '#0f172a',
    fontSize: '1.35rem',
    fontWeight: '900',
    marginBottom: '0.55rem'
  },
  loadingText: {
    color: '#475569',
    fontWeight: '700'
  },
  formFieldset: {
    border: 'none',
    padding: 0,
    margin: 0,
    minWidth: 0
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: '2rem',
    borderRadius: '0.9rem',
    marginBottom: '2rem',
    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.09)',
    border: '1px solid #dbe4f0'
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    color: '#1f2937'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  fieldHelp: {
    marginTop: '0.35rem',
    color: '#64748b',
    fontSize: '0.78rem'
  },
  formActions: {
    display: 'flex',
    gap: '1rem'
  },
  filterCard: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    padding: '1.5rem',
    borderRadius: '0.9rem',
    marginBottom: '2rem',
    boxShadow: '0 16px 34px rgba(15, 23, 42, 0.09)',
    border: '1px solid #dbe4f0'
  },
  filterTitle: {
    fontSize: '1.05rem',
    fontWeight: '800',
    marginBottom: '1rem',
    color: '#0f172a',
    margin: '0 0 1rem 0'
  },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    alignItems: 'flex-end'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  filterLabel: {
    fontSize: '0.78rem',
    fontWeight: '800',
    marginBottom: '0.5rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  filterSelect: {
    padding: '0.85rem 0.95rem',
    border: '1px solid #cbd5e1',
    borderRadius: '0.75rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: '650',
    outline: 'none'
  },
  filterInfo: {
    padding: '0.85rem 0.95rem',
    backgroundColor: '#ecfeff',
    borderRadius: '0.75rem',
    color: '#0e7490',
    fontWeight: '800',
    border: '1px solid #a5f3fc'
  },
  tableCard: {
    backgroundColor: '#ffffff',
    padding: '1rem',
    borderRadius: '0.9rem',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.10)',
    border: '1px solid #dbe4f0',
    overflowX: 'auto',
    scrollbarColor: '#94a3b8 #e2e8f0'
  },
  table: {
    width: '100%',
    minWidth: '980px',
    borderCollapse: 'separate',
    borderSpacing: 0
  },
  tableHeader: {
    backgroundColor: '#0f172a'
  },
  th: {
    padding: '1.05rem 0.9rem',
    textAlign: 'left',
    fontWeight: '900',
    color: '#ffffff',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 100%)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    boxShadow: 'inset 0 -1px 0 rgba(255, 255, 255, 0.16)'
  },
  tableRow: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    transition: 'background-color 0.2s ease',
    boxShadow: 'inset 4px 0 0 transparent'
  },
  td: {
    padding: '0.95rem 0.9rem',
    color: '#1f2937',
    borderBottom: '1px solid #edf2f7',
    verticalAlign: 'middle',
    fontSize: '0.92rem'
  },
  floorGroupCell: {
    padding: '0.8rem 0.9rem',
    background: 'linear-gradient(90deg, #0f766e 0%, #2563eb 100%)',
    borderTop: '1rem solid #ffffff',
    borderBottom: '1px solid #cbd5e1',
    position: 'sticky',
    top: '3.05rem',
    zIndex: 1,
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)'
  },
  floorGroupContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  floorGroupMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    minWidth: '260px'
  },
  floorGroupTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap',
    color: '#ffffff',
    fontSize: '0.98rem',
    fontWeight: '900',
    letterSpacing: '0.02em'
  },
  floorGroupBuilding: {
    color: '#ccfbf1'
  },
  floorGroupSeparator: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '700'
  },
  floorGroupUnitList: {
    color: '#e0f2fe',
    fontSize: '0.78rem',
    fontWeight: '700',
    lineHeight: 1.45,
    maxWidth: '680px'
  },
  floorGroupStats: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap'
  },
  floorGroupCount: {
    color: '#0f172a',
    fontSize: '0.8rem',
    fontWeight: '900',
    backgroundColor: '#ffffff',
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.16)'
  },
  floorGroupTenantCount: {
    color: '#064e3b',
    fontSize: '0.8rem',
    fontWeight: '900',
    backgroundColor: '#ccfbf1',
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.14)'
  },
  primaryCellText: {
    color: '#0f172a',
    fontWeight: '800',
    lineHeight: 1.35,
    maxWidth: '260px'
  },
  unitPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '74px',
    padding: '0.42rem 0.7rem',
    borderRadius: '999px',
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    fontWeight: '900',
    fontSize: '0.84rem',
    whiteSpace: 'nowrap'
  },
  floorPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.38rem 0.7rem',
    borderRadius: '999px',
    backgroundColor: '#eef2ff',
    color: '#3730a3',
    border: '1px solid #c7d2fe',
    fontWeight: '800',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap'
  },
  typeTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.35rem 0.7rem',
    backgroundColor: '#f0fdfa',
    color: '#0f766e',
    border: '1px solid #99f6e4',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: '800',
    textTransform: 'capitalize'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.36rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: '800',
    textTransform: 'capitalize',
    minWidth: '86px'
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'nowrap'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2.5rem',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: '0.75rem',
    fontWeight: '800'
  },
  noDataSmall: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    margin: '0.5rem 0 0 0'
  }
};

export default Units;
