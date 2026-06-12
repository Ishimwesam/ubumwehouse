import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildingService, dashboardService, resolveUploadUrl } from '../services/api';
import { useDataSync } from '../context/DataSyncContext';
import { FLOOR_OPTIONS, parseBuildingFloors } from '../utils/floorOptions';
import useFeedbackToast from '../hooks/useFeedbackToast';
import PageLoader from '../components/PageLoader';

const formatCurrency = (value) => `${parseFloat(value || 0).toLocaleString()} RWF`;

const sanitizeSelectedFloors = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const normalizeFloorLabel = (value) => value.trim().replace(/\s+/g, ' ').toUpperCase();
const idsEqual = (first, second) => String(first || '') === String(second || '');

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
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

const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="m21 15-4.5-4.5L11 16l-2-2-6 6" />
  </svg>
);

const BuildingImage = ({ src, name }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div style={styles.buildingImagePlaceholder}>
        <ImageIcon />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      style={styles.buildingImage}
      onError={() => setFailed(true)}
    />
  );
};

const Buildings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { versions, notifyDataChanged } = useDataSync();
  const [buildings, setBuildings] = useState([]);
  const [buildingPerformance, setBuildingPerformance] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [customFloors, setCustomFloors] = useState([]);
  const [showFloorCreator, setShowFloorCreator] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingImageId, setUploadingImageId] = useState(null);
  const canManageOperations = isManager();
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    total_floors: 1,
    available_floors: []
  });

  const showExpectedFocus = new URLSearchParams(location.search).get('focus') === 'expected';
  const allFloorOptions = Array.from(new Set([...FLOOR_OPTIONS, ...customFloors]));

  useEffect(() => {
    fetchBuildings();
    fetchBuildingPerformance();
  }, [versions.buildings, versions.payments, versions.units]);

  const fetchBuildings = async () => {
    try {
      const response = await buildingService.getAll();
      setBuildings(response.data);
    } catch (err) {
      setError('Failed to load buildings');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildingPerformance = async () => {
    try {
      const response = await dashboardService.getBuildingPerformance();
      setBuildingPerformance(response.data || []);
    } catch (err) {
      setBuildingPerformance([]);
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

    if (formData.available_floors.length === 0) {
      setError('Select at least one floor for the building');
      return;
    }
    if (!formData.name.trim()) {
      setError('Building name is required');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await buildingService.update(editingId, formData);
        setSuccess('Building updated successfully');
      } else {
        await buildingService.create(formData);
        setSuccess('Building created successfully');
      }

      notifyDataChanged(['buildings', 'units', 'dashboard', 'reports']);

      resetForm();
      fetchBuildings();
      fetchBuildingPerformance();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save building');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (building) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    const selectedFloors = parseBuildingFloors(building.available_floors);
    const extraFloors = selectedFloors.filter((floor) => !FLOOR_OPTIONS.includes(floor));

    setFormData({
      name: building.name,
      address: building.address || '',
      city: building.city || '',
      country: building.country || '',
      total_floors: selectedFloors.length || building.total_floors || 1,
      available_floors: selectedFloors
    });
    setCustomFloors(extraFloors);
    setNewFloorName('');
    setShowFloorCreator(false);
    setEditingId(building.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this building?')) {
      try {
        setDeletingId(id);
        await buildingService.delete(id);
        setSuccess('Building deleted successfully');
        notifyDataChanged(['buildings', 'units', 'dashboard', 'reports']);
        fetchBuildings();
        fetchBuildingPerformance();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete building');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleBuildingImageChange = async (building, file) => {
    if (!file) return;

    setError('');
    setSuccess('');

    if (!canManageOperations) {
      setError('You have view-only access on this page.');
      return;
    }

    if (!file.type?.startsWith('image/')) {
      setError('Choose a JPG or PNG image for the building.');
      return;
    }

    try {
      setUploadingImageId(building.id);
      const response = await buildingService.updateImage(building.id, file);
      const updatedBuilding = response.data?.building;
      if (updatedBuilding) {
        setBuildings((currentBuildings) => currentBuildings.map((item) => (
          idsEqual(item.id, updatedBuilding.id) ? updatedBuilding : item
        )));
      } else {
        await fetchBuildings();
      }
      notifyDataChanged(['buildings', 'dashboard']);
      setSuccess(`Picture updated for ${building.name}.`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update building picture');
    } finally {
      setUploadingImageId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      total_floors: 1,
      available_floors: []
    });
    setCustomFloors([]);
    setNewFloorName('');
    setShowFloorCreator(false);
    setEditingId(null);
    setShowForm(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFloorToggle = (floorLabel) => {
    setFormData((prev) => {
      const selectedFloors = sanitizeSelectedFloors(prev.available_floors);
      const nextFloors = selectedFloors.includes(floorLabel)
        ? selectedFloors.filter((item) => item !== floorLabel)
        : [...selectedFloors, floorLabel];

      return {
        ...prev,
        available_floors: nextFloors,
        total_floors: nextFloors.length || 1
      };
    });
  };

  const handleCreateFloor = () => {
    setError('');
    setSuccess('');

    const normalizedFloor = normalizeFloorLabel(newFloorName || '');
    if (!normalizedFloor) {
      setError('Enter a floor name before creating it.');
      return;
    }

    if (allFloorOptions.includes(normalizedFloor)) {
      setError('That floor already exists in the list.');
      return;
    }

    setCustomFloors((prev) => [...prev, normalizedFloor]);
    setFormData((prev) => {
      const selectedFloors = sanitizeSelectedFloors(prev.available_floors);
      const nextFloors = [...selectedFloors, normalizedFloor];

      return {
        ...prev,
        available_floors: nextFloors,
        total_floors: nextFloors.length
      };
    });
    setNewFloorName('');
    setShowFloorCreator(false);
    setSuccess(`Floor ${normalizedFloor} created and selected.`);
  };

  const getBuildingPerformance = (building) => {
    return buildingPerformance.find((item) => idsEqual(item.id, building.id) || idsEqual(item.building_id, building.id)) || null;
  };

  if (loading) return <PageLoader text="Loading buildings..." />;

  return (
    <div className="buildings-page-shell" style={styles.container}>
      <style>{`
        @keyframes buildingFloorPulse {
          0% { transform: translateY(0); box-shadow: 0 14px 26px rgba(79, 70, 229, 0.18); }
          50% { transform: translateY(-1px); box-shadow: 0 18px 30px rgba(37, 99, 235, 0.26); }
          100% { transform: translateY(0); box-shadow: 0 14px 26px rgba(79, 70, 229, 0.18); }
        }
      `}</style>
      <div style={styles.header}>
        <div style={styles.headerIntro}>
          <div style={styles.eyebrowPill}>Property Portfolio</div>
          <h1 style={styles.title}>Buildings Management</h1>
          <p style={styles.subtitle}>Review properties, occupancy, and collection performance clearly.</p>
        </div>
        <button
          type="button"
          style={{ ...styles.btnPrimary, ...(!canManageOperations ? styles.btnDisabled : {}) }}
          onClick={() => setShowForm(!showForm)}
          disabled={!canManageOperations}
        >
          <span style={styles.buttonInner}>
            <PlusIcon />
            <span>{showForm ? 'Cancel' : 'Add Building'}</span>
          </span>
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {!canManageOperations ? (
        <div style={styles.readOnlyBanner}>
          You have view-only access here. Building details remain visible, but adding, editing, and deleting buildings is limited to managers and admins.
        </div>
      ) : null}

      {showExpectedFocus && (
        <div style={styles.focusBanner}>
          Monthly Expected selected from Dashboard. Review expected and collected amounts for each building below.
        </div>
      )}

      {showForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>
            {editingId ? 'Edit Building' : 'Add New Building'}
          </h2>
          <form onSubmit={handleSubmit}>
            <fieldset style={styles.formFieldset} disabled={!canManageOperations}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label>Building Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>

              <div style={styles.formGroup}>
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                />
              </div>

              <div style={styles.formGroupFull}>
                <label>Available Floors *</label>
                <div style={styles.floorGrid}>
                  {allFloorOptions.map((floorLabel) => {
                    const selected = sanitizeSelectedFloors(formData.available_floors).includes(floorLabel);
                    return (
                      <button
                        type="button"
                        key={floorLabel}
                        onClick={() => handleFloorToggle(floorLabel)}
                        style={{
                        ...styles.floorOption,
                        ...(selected ? styles.floorOptionSelected : {})
                      }}
                      >
                        <span style={{ ...styles.floorCheckbox, ...(selected ? styles.floorCheckboxSelected : {}) }} aria-hidden="true">
                          {selected ? '✓' : ''}
                        </span>
                        <span style={styles.floorOptionText}>{floorLabel}</span>
                      </button>
                    );
                  })}
                </div>
                <small style={styles.fieldHelp}>
                  Selected: {sanitizeSelectedFloors(formData.available_floors).length} floor(s)
                </small>
              </div>
            </div>

            <div style={styles.formActions}>
              <button
                type="submit"
                style={{ ...styles.btnPrimary, ...(!canManageOperations || saving ? styles.btnDisabled : {}) }}
                disabled={!canManageOperations || saving}
              >
                {!canManageOperations ? 'View Only' : saving ? 'Saving...' : editingId ? 'Update Building' : 'Create Building'}
              </button>
              <button
                type="button"
                style={{ ...styles.btnCreateFloors, ...(!canManageOperations ? styles.btnDisabled : {}) }}
                onClick={() => setShowFloorCreator((prev) => !prev)}
                disabled={!canManageOperations}
              >
                <span style={styles.buttonInner}>
                  <PlusIcon />
                  <span>{showFloorCreator ? 'Close Floor Creator' : 'Create Floors'}</span>
                </span>
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
            {showFloorCreator ? (
              <div style={styles.floorCreatorCard}>
                <div style={styles.floorCreatorTitle}>Create a custom floor</div>
                <div style={styles.floorCreatorRow}>
                  <input
                    type="text"
                    value={newFloorName}
                    onChange={(event) => setNewFloorName(event.target.value)}
                    placeholder="E.g. 4TH FLOOR or MEZZANINE"
                    style={styles.floorCreatorInput}
                  />
                  <button
                    type="button"
                    style={styles.floorCreatorButton}
                    onClick={handleCreateFloor}
                  >
                    Add Floor
                  </button>
                </div>
                <div style={styles.floorCreatorHint}>New floors are added to this building form immediately and selected automatically.</div>
              </div>
            ) : null}
            </fieldset>
          </form>
        </div>
      )}

      {/* Buildings Grid */}
      <div style={styles.buildingGrid}>
        {buildings.length > 0 ? (
          buildings.map((building) => {
            const performance = getBuildingPerformance(building);
            const expected = performance?.expected_income || 0;
            const collected = performance?.this_month_income ?? 0;
            const tenantCount = performance?.tenant_count || 0;
            const buildingImageUrl = resolveUploadUrl(building.image_url);
            return (
            <div key={building.id} style={styles.buildingCard}>
              <div style={styles.buildingImageFrame}>
                <BuildingImage src={buildingImageUrl} name={building.name} />
              </div>
              <h3 style={styles.buildingName}>{building.name}</h3>
              <p style={styles.buildingInfo}>
                <strong>Address:</strong> {building.address}
              </p>
              <p style={styles.buildingInfo}>
                <strong>City:</strong> {building.city}
              </p>
              <p style={styles.buildingInfo}>
                <strong>Country:</strong> {building.country}
              </p>
              <p style={styles.buildingInfo}>
                <strong>Floors:</strong> {parseBuildingFloors(building.available_floors).length || building.total_floors || 0}
              </p>
              <p style={styles.buildingInfo}>
                <strong>Available Floors:</strong> {parseBuildingFloors(building.available_floors).length > 0
                  ? parseBuildingFloors(building.available_floors).join(', ')
                  : 'Not configured'}
              </p>
              <div style={styles.metricBlock}>
                <p style={styles.metricRow}>
                  <strong>Monthly Expected:</strong> <span style={styles.metricValue}>{formatCurrency(expected)}</span>
                </p>
                <p style={styles.metricRow}>
                  <strong>Collected This Month:</strong> <span style={styles.metricValue}>{formatCurrency(collected)}</span>
                </p>
                <p style={styles.metricRow}>
                  <strong>Registered Tenants:</strong> <span style={styles.metricValue}>{tenantCount}</span>
                </p>
              </div>
              <div style={styles.cardActions}>
                <button
                  type="button"
                  style={{ ...styles.btnSmall, ...styles.btnView }}
                  onClick={() => navigate(`/buildings/${building.id}`)}
                  title="View building tenants"
                >
                  <span style={styles.buttonInner}>
                    <EyeIcon />
                    <span>View Tenants</span>
                  </span>
                </button>
                <button
                  type="button"
                  style={{ ...styles.btnSmall, ...styles.btnAddTenant, ...(!canManageOperations ? styles.btnDisabled : {}) }}
                  onClick={() => navigate('/tenants', {
                    state: {
                      addTenantForBuilding: {
                        buildingId: building.id,
                        buildingName: building.name
                      }
                    }
                  })}
                  title="Add tenant to this building"
                  disabled={!canManageOperations}
                >
                  <span style={styles.buttonInner}>
                    <PlusIcon />
                    <span>Add Tenant</span>
                  </span>
                </button>
                <button
                  type="button"
                  style={{ ...styles.btnSmall, ...styles.btnEdit, ...(!canManageOperations ? styles.btnDisabled : {}) }}
                  onClick={() => handleEdit(building)}
                  title="Edit building"
                  disabled={!canManageOperations}
                >
                  <span style={styles.buttonInner}>
                    <EditIcon />
                    <span>Edit</span>
                  </span>
                </button>
                <label
                  style={{
                    ...styles.btnSmall,
                    ...styles.btnImage,
                    ...(!canManageOperations || uploadingImageId === building.id ? styles.btnDisabled : {})
                  }}
                  title="Change house picture"
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    style={styles.hiddenFileInput}
                    disabled={!canManageOperations || uploadingImageId === building.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      handleBuildingImageChange(building, file);
                    }}
                  />
                  <span style={styles.buttonInner}>
                    <ImageIcon />
                    <span>{uploadingImageId === building.id ? 'Uploading...' : 'Change Picture'}</span>
                  </span>
                </label>
                <button
                  type="button"
                  style={{ ...styles.btnSmall, ...styles.btnDanger, ...(!canManageOperations || deletingId === building.id ? styles.btnDisabled : {}) }}
                  onClick={() => handleDelete(building.id)}
                  title="Delete building"
                  disabled={!canManageOperations || deletingId === building.id}
                >
                  <span style={styles.buttonInner}>
                    <TrashIcon />
                    <span>{deletingId === building.id ? 'Deleting...' : 'Delete'}</span>
                  </span>
                </button>
              </div>
            </div>
          );
          })
        ) : (
          <p style={styles.noData}>No buildings found</p>
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
    backgroundColor: '#f8fafc',
    color: '#1f2937',
    border: '1px solid #dbe4f0',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '600'
  },
  btnCreateFloors: {
    padding: '0.85rem 1.15rem',
    background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 55%, #0ea5e9 100%)',
    backgroundSize: '200% 200%',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    animation: 'buildingFloorPulse 2.2s ease-in-out infinite'
  },
  btnSmall: {
    padding: '0.6rem 0.85rem',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: '0.8rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '700',
    transition: 'background-color 0.2s ease',
    whiteSpace: 'nowrap'
  },
  btnView: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe'
  },
  btnAddTenant: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0'
  },
  btnEdit: {
    backgroundColor: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1'
  },
  btnImage: {
    backgroundColor: '#f0fdfa',
    color: '#0f766e',
    border: '1px solid #99f6e4'
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
  focusBanner: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    border: '1px solid #93c5fd',
    padding: '0.9rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
    fontWeight: '600'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem'
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
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    padding: '2rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.12)',
    border: '1px solid #cbd5e1'
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
  formGroupFull: {
    display: 'flex',
    flexDirection: 'column',
    gridColumn: '1 / -1'
  },
  floorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '0.75rem',
    marginTop: '0.5rem'
  },
  floorOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.75rem 0.9rem',
    border: '1px solid #cbd5e1',
    borderRadius: '0.5rem',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    cursor: 'pointer'
  },
  floorCheckbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1.5px solid #94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 800,
    color: '#ffffff',
    background: '#ffffff',
    flexShrink: 0
  },
  floorCheckboxSelected: {
    background: '#2563eb',
    borderColor: '#2563eb'
  },
  floorOptionText: {
    fontWeight: '600',
    letterSpacing: '0.01em'
  },
  floorOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
    boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.15)'
  },
  fieldHelp: {
    marginTop: '0.5rem',
    color: '#475569',
    fontSize: '0.875rem'
  },
  formActions: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  floorCreatorCard: {
    marginTop: '1rem',
    padding: '1rem',
    borderRadius: '0.85rem',
    border: '1px solid #c7d2fe',
    background: 'linear-gradient(180deg, #f8faff 0%, #eef4ff 100%)'
  },
  floorCreatorTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: '0.75rem'
  },
  floorCreatorRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  floorCreatorInput: {
    flex: '1 1 260px',
    minHeight: '46px',
    border: '1px solid #cbd5e1',
    borderRadius: '0.75rem',
    padding: '0 0.9rem',
    fontSize: '0.95rem',
    fontFamily: 'inherit'
  },
  floorCreatorButton: {
    minHeight: '46px',
    padding: '0 1rem',
    border: 'none',
    borderRadius: '0.75rem',
    background: '#1d4ed8',
    color: '#ffffff',
    fontWeight: '700',
    cursor: 'pointer'
  },
  floorCreatorHint: {
    marginTop: '0.65rem',
    color: '#475569',
    fontSize: '0.84rem',
    lineHeight: 1.5
  },
  buildingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.5rem'
  },
  buildingCard: {
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.12)',
    border: '1px solid #cbd5e1',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  },
  buildingImageFrame: {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    marginBottom: '1rem',
    backgroundColor: '#e2e8f0',
    border: '1px solid #cbd5e1'
  },
  buildingImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  },
  buildingImagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f766e',
    background: 'linear-gradient(135deg, #ecfeff 0%, #f8fafc 58%, #dbeafe 100%)'
  },
  buildingName: {
    fontSize: '1.25rem',
    fontWeight: '600',
    margin: '0 0 1rem 0',
    color: '#1f2937'
  },
  buildingInfo: {
    margin: '0.5rem 0',
    color: '#6b7280',
    fontSize: '0.875rem'
  },
  metricBlock: {
    marginTop: '0.75rem',
    padding: '0.65rem 0.8rem',
    backgroundColor: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '0.5rem'
  },
  metricRow: {
    margin: '0.35rem 0',
    color: '#334155',
    fontSize: '0.84rem'
  },
  metricValue: {
    color: '#0f172a',
    fontWeight: '700'
  },
  metricErrorRow: {
    margin: '0.45rem 0 0 0',
    color: '#991b1b',
    fontSize: '0.8rem',
    fontWeight: '700'
  },
  cardActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
    flexWrap: 'wrap'
  },
  hiddenFileInput: {
    display: 'none'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2rem',
    gridColumn: '1 / -1'
  }
};

export default Buildings;
