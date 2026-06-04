import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auditService, authService, resolveUploadUrl, systemService } from '../services/api';
import useFeedbackToast from '../hooks/useFeedbackToast';
import { appFontOptions, getStoredAppFont, storeAndApplyAppFont } from '../utils/appFont';

const tabOptions = [
  { key: 'profile', label: 'Profile', hint: 'Identity and picture', icon: '👤' },
  { key: 'password', label: 'Password', hint: 'Update security', icon: '🔒' },
  { key: 'account', label: 'Account', hint: 'Session and info', icon: '⚙️' },
  { key: 'appearance', label: 'Appearance', hint: 'Font selection', icon: 'Aa', adminOnly: true },
  { key: 'users', label: 'Users', hint: 'Create staff accounts', icon: '👥', adminOnly: true },
  { key: 'audit', label: 'Audit Logs', hint: 'Review system activity', icon: '🛡️', adminOnly: true },
  { key: 'system', label: 'System Health', hint: 'Backups and protection', icon: '🧰', adminOnly: true }
];

const formatAuditDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatBytes = (bytes) => {
  const numericBytes = Number(bytes || 0);
  if (!numericBytes) return '-';
  if (numericBytes < 1024 * 1024) return `${(numericBytes / 1024).toFixed(1)} KB`;
  return `${(numericBytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatBackupAge = (hours) => {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.max(Math.round(hours * 60), 1)} minutes ago`;
  if (hours < 24) return `${hours.toFixed(1)} hours ago`;
  return `${(hours / 24).toFixed(1)} days ago`;
};

const getAuditStatusStyle = (statusCode) => {
  if (!statusCode) return styles.auditStatusMuted;
  if (statusCode >= 500) return styles.auditStatusDanger;
  if (statusCode >= 400) return styles.auditStatusWarn;
  return styles.auditStatusOk;
};

const Settings = () => {
  const { user, logoutWithFarewell, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [selectedFont, setSelectedFont] = useState(getStoredAppFont);
  const [profileImageRefreshKey, setProfileImageRefreshKey] = useState(0);
  const isAdmin = user?.role === 'admin';
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || ''
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [newUserData, setNewUserData] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    role: 'user',
    password: '',
    confirmPassword: ''
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLimit, setAuditLimit] = useState(200);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupVerifying, setBackupVerifying] = useState(false);
  const [backupVerification, setBackupVerification] = useState(null);
  const [userList, setUserList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetPasswords, setResetPasswords] = useState({});
  const [restoreBackupName, setRestoreBackupName] = useState('');
  const [restorePreparing, setRestorePreparing] = useState(false);
  const [messagingStatus, setMessagingStatus] = useState(null);
  const [messagingLoading, setMessagingLoading] = useState(false);

  const profileImageUrl = useMemo(() => {
    if (!user?.profile_image) return null;

    const resolvedUrl = resolveUploadUrl(user.profile_image);
    if (!resolvedUrl) return null;

    const separator = resolvedUrl.includes('?') ? '&' : '?';
    const cacheBuster = encodeURIComponent(user?.updated_at || profileImageRefreshKey);
    return `${resolvedUrl}${separator}v=${cacheBuster}`;
  }, [user?.profile_image, user?.updated_at, profileImageRefreshKey]);
  const displayedProfileImageUrl = selectedImagePreviewUrl || profileImageUrl;

  useEffect(() => {
    setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        email: user.email || ''
      });
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'audit' && isAdmin) {
      fetchAuditLogs();
    }
  }, [activeTab, auditLimit, isAdmin]);

  useEffect(() => {
    if (activeTab === 'system' && isAdmin) {
      fetchBackupStatus();
      fetchMessagingStatus();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (!selectedImage || !selectedImage.type?.startsWith('image/')) {
      setSelectedImagePreviewUrl(null);
      return undefined;
    }

    setCropZoom(1);
    setCropX(0);
    setCropY(0);

    const objectUrl = URL.createObjectURL(selectedImage);
    setSelectedImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authService.updateProfile(profileData);
      await refreshProfile();
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authService.changePassword({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      setSuccess('Password changed successfully');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImageSelect = (e) => {
    const file = e.target.files?.[0] || null;

    setError('');
    setSuccess('');

    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (!file.type?.startsWith('image/')) {
      setSelectedImage(null);
      e.target.value = '';
      setError('Please choose a JPG or PNG image.');
      return;
    }

    setSelectedImage(file);
  };

  const buildCroppedProfileImage = async (file) => {
    if (!file?.type?.startsWith('image/')) return file;

    const sourceUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load selected image for cropping.'));
        img.src = sourceUrl;
      });

      const canvasSize = 720;
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to initialize crop canvas.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvasSize, canvasSize);

      const baseScale = Math.max(canvasSize / image.width, canvasSize / image.height);
      const scaledWidth = image.width * baseScale * cropZoom;
      const scaledHeight = image.height * baseScale * cropZoom;
      const drawX = (canvasSize - scaledWidth) / 2 + cropX;
      const drawY = (canvasSize - scaledHeight) / 2 + cropY;

      context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

      const croppedBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to generate cropped image.'));
            return;
          }
          resolve(blob);
        }, 'image/jpeg', 0.92);
      });

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile-image';
      return new File([croppedBlob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const handleFontChange = (e) => {
    const nextFont = e.target.value;
    setSelectedFont(nextFont);
    storeAndApplyAppFont(nextFont);
    setSuccess('Font updated successfully');
    setError('');
  };

  const handleProfileImageUpload = async () => {
    if (!selectedImage || selectedImage.size === 0) {
      setError('Choose an image before uploading.');
      return;
    }

    setError('');
    setSuccess('');
    setUploadingImage(true);

    try {
      const fileToUpload = await buildCroppedProfileImage(selectedImage);
      await authService.uploadProfilePicture(fileToUpload);
      await refreshProfile();
      setSelectedImage(null);
      setProfileImageRefreshKey((previous) => previous + 1);
      setSuccess('Profile picture updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isAdmin) {
      setError('Only admin can create users');
      return;
    }

    if (newUserData.password !== newUserData.confirmPassword) {
      setError('User passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.createUser({
        username: newUserData.username.trim(),
        email: newUserData.email.trim(),
        password: newUserData.password,
        full_name: newUserData.full_name.trim(),
        phone: newUserData.phone.trim(),
        role: newUserData.role
      });

      setSuccess(response.data?.message || 'User created successfully');
      fetchUsers();
      setNewUserData({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        role: 'user',
        password: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    setError('');

    try {
      const response = await authService.listUsers();
      setUserList(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleToggleUserStatus = async (targetUser) => {
    if (!targetUser) return;
    setError('');
    setSuccess('');

    try {
      const response = await authService.updateUserStatus(targetUser.id, !targetUser.is_active);
      setSuccess(response.data?.message || 'User status updated');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleResetUserPassword = async (targetUser) => {
    const newPassword = resetPasswords[targetUser.id] || '';
    if (!newPassword) {
      setError('Enter a new password before resetting this user');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await authService.resetUserPassword(targetUser.id, newPassword);
      setSuccess(response.data?.message || 'User password reset successfully');
      setResetPasswords((prev) => ({ ...prev, [targetUser.id]: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset user password');
    }
  };

  const fetchAuditLogs = async () => {
    if (!isAdmin) return;

    setAuditLoading(true);
    setError('');

    try {
      const response = await auditService.getLogs(auditLimit);
      setAuditLogs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchBackupStatus = async () => {
    if (!isAdmin) return;

    setBackupLoading(true);
    setError('');

    try {
      const response = await systemService.getBackupStatus();
      const status = response.data || null;
      setBackupStatus(status);
      if (!restoreBackupName && status?.latest_backup?.name) {
        setRestoreBackupName(status.latest_backup.name);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load backup status');
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchMessagingStatus = async () => {
    if (!isAdmin) return;

    setMessagingLoading(true);

    try {
      const response = await systemService.getMessagingStatus();
      setMessagingStatus(response.data || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load messaging status');
    } finally {
      setMessagingLoading(false);
    }
  };

  const handleRunBackup = async () => {
    if (!isAdmin) return;

    setBackupRunning(true);
    setError('');
    setSuccess('');

    try {
      const response = await systemService.runBackup();
      setBackupStatus(response.data?.status || null);
      setSuccess(response.data?.message || 'Encrypted backup created successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create backup');
    } finally {
      setBackupRunning(false);
    }
  };

  const handleVerifyBackup = async () => {
    if (!isAdmin) return;

    setBackupVerifying(true);
    setError('');
    setSuccess('');

    try {
      const response = await systemService.verifyBackup();
      setBackupVerification(response.data || null);
      setBackupStatus(response.data?.status || backupStatus);
      setSuccess(response.data?.message || 'Latest backup verified successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify latest backup');
    } finally {
      setBackupVerifying(false);
    }
  };

  const handlePrepareRestore = async () => {
    if (!restoreBackupName) {
      setError('Select a backup before preparing restore');
      return;
    }

    setRestorePreparing(true);
    setError('');
    setSuccess('');

    try {
      const response = await systemService.restoreBackup(restoreBackupName);
      setBackupStatus(response.data?.status || backupStatus);
      setSuccess(response.data?.message || 'Restore prepared. Restart the backend to apply it.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to prepare backup restore');
    } finally {
      setRestorePreparing(false);
    }
  };

  const visibleTabs = tabOptions.filter((tab) => !tab.adminOnly || isAdmin);
  const failedAuditCount = auditLogs.filter((log) => Number(log.status_code) >= 400).length;
  const writeAuditCount = auditLogs.filter((log) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(log.method)).length;
  const latestBackup = backupStatus?.latest_backup || null;
  const backupHistory = backupStatus?.backups || [];
  const backupHealthText = backupStatus?.health_message || 'Check status to read backup health.';

  return (
    <div className="settings-page-shell" style={styles.page}>
      <div style={styles.headerIntro}>
        <div style={styles.headerTopRow}>
          <div>
            <div style={styles.eyebrowPill}>Account Controls</div>
            <h1 style={styles.title}>Settings</h1>
            <p style={styles.subtitle}>Update your profile, security, and account controls clearly.</p>
          </div>
          <div style={styles.headerProfileCard}>
            {displayedProfileImageUrl ? (
              <img src={displayedProfileImageUrl} alt="Profile" style={styles.headerProfileImage} />
            ) : (
              <div style={styles.headerProfilePlaceholder}>
                {(user?.username || user?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div style={styles.headerProfileText}>{profileData.full_name || user?.username || 'Administrator'}</div>
          </div>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {success ? <div style={styles.success}>{success}</div> : null}

      <div style={styles.container}>
        <aside style={styles.tabsPanel}>
          <div style={styles.tabsPanelTitle}>Settings Sections</div>
          <div style={styles.tabsPanelText}>Choose a section to manage your profile, password, account details, and admin tools.</div>
          <div style={styles.tabsProfileCard}>
            {displayedProfileImageUrl ? (
              <img src={displayedProfileImageUrl} alt="Profile" style={styles.tabsProfileImage} />
            ) : (
              <div style={styles.tabsProfilePlaceholder}>
                {(user?.username || user?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div style={styles.tabsProfileMeta}>
              <div style={styles.tabsProfileName}>{profileData.full_name || user?.username || 'Administrator'}</div>
              <div style={styles.tabsProfileEmail}>{profileData.email || user?.email || 'No email set'}</div>
            </div>
          </div>
          <div style={styles.tabs}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{
                  ...styles.tab,
                  ...(activeTab === tab.key ? styles.tabActive : {})
                }}
                onClick={() => setActiveTab(tab.key)}
              >
                <span style={styles.tabIcon}>{tab.icon}</span>
                <span style={styles.tabTextBlock}>
                  <span style={styles.tabLabel}>{tab.label}</span>
                  <span style={styles.tabHint}>{tab.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {activeTab === 'profile' ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Profile Information</h2>
                <p style={styles.cardSubtitle}>Keep your personal identity and account email up to date.</p>
              </div>
              <div style={styles.roleChip}>{user?.role || 'user'}</div>
            </div>

            <div style={styles.profileHero}>
              <div style={styles.profilePreviewCard}>
                <div style={styles.profileImageWrap}>
                  {displayedProfileImageUrl ? (
                    <img src={displayedProfileImageUrl} alt="Profile" style={styles.profileImage} />
                  ) : (
                    <div style={styles.profilePlaceholder}>
                      {(user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={styles.profileMeta}>
                  <div style={styles.profileName}>{profileData.full_name || 'Administrator'}</div>
                  <div style={styles.profileEmail}>{profileData.email || 'No email set'}</div>
                </div>
              </div>

              <div style={styles.uploadCard}>
                <div style={styles.uploadCardTitle}>Profile</div>
                <div style={styles.fileName}>{selectedImage ? selectedImage.name : 'No file chosen'}</div>
                {selectedImagePreviewUrl ? (
                  <>
                    <div style={styles.cropPreviewFrame}>
                      <img
                        src={selectedImagePreviewUrl}
                        alt="Selected profile preview"
                        style={{
                          ...styles.uploadPreviewImage,
                          transform: `translate(${cropX}px, ${cropY}px) scale(${cropZoom})`
                        }}
                      />
                    </div>
                    <div style={styles.cropControls}>
                      <div style={styles.cropControlRow}>
                        <label style={styles.cropLabel}>Zoom</label>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.01"
                          value={cropZoom}
                          onChange={(event) => setCropZoom(Number(event.target.value))}
                          style={styles.cropSlider}
                        />
                      </div>
                      <div style={styles.cropControlRow}>
                        <label style={styles.cropLabel}>Horizontal</label>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={cropX}
                          onChange={(event) => setCropX(Number(event.target.value))}
                          style={styles.cropSlider}
                        />
                      </div>
                      <div style={styles.cropControlRow}>
                        <label style={styles.cropLabel}>Vertical</label>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={cropY}
                          onChange={(event) => setCropY(Number(event.target.value))}
                          style={styles.cropSlider}
                        />
                      </div>
                      <button
                        type="button"
                        style={styles.cropResetButton}
                        onClick={() => {
                          setCropZoom(1);
                          setCropX(0);
                          setCropY(0);
                        }}
                      >
                        Reset Crop
                      </button>
                    </div>
                  </>
                ) : null}
                <input
                  id="settings-profile-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleProfileImageSelect}
                  style={styles.hiddenInput}
                />
                <div style={styles.uploadControls}>
                  <label htmlFor="settings-profile-upload" style={styles.fileSelectButton}>
                    Choose Image
                  </label>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    disabled={!selectedImage || uploadingImage}
                    onClick={handleProfileImageUpload}
                  >
                    {uploadingImage ? 'Uploading...' : 'Upload Profile Picture'}
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={profileData.full_name}
                    onChange={handleProfileChange}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    style={styles.input}
                  />
                </div>
              </div>

              <button type="submit" style={styles.btnPrimary} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </section>
        ) : null}

        {activeTab === 'password' ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Password</h2>
                <p style={styles.cardSubtitle}>Change your password regularly to keep the workspace secure.</p>
              </div>
              <div style={styles.infoChip}>Security</div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Current Password</label>
                  <input
                    type="password"
                    name="oldPassword"
                    value={passwordData.oldPassword}
                    onChange={handlePasswordChange}
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    style={styles.input}
                  />
                </div>

                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <button type="submit" style={styles.btnPrimary} disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>
        ) : null}

        {activeTab === 'account' ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Account</h2>
                <p style={styles.cardSubtitle}>Review your workspace identity and manage your current session.</p>
              </div>
              <div style={styles.infoChip}>Workspace</div>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Username</div>
                <div style={styles.infoValue}>{user?.username || '-'}</div>
              </div>
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Email</div>
                <div style={styles.infoValue}>{user?.email || '-'}</div>
              </div>
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Role</div>
                <div style={styles.infoValue}>{user?.role || '-'}</div>
              </div>
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Account Created</div>
                <div style={styles.infoValue}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</div>
              </div>
            </div>

            <div style={styles.logoutSection}>
              <h3 style={styles.logoutTitle}>Logout</h3>
              <p style={styles.logoutText}>Sign out from your account on this device.</p>
              <button type="button" onClick={logoutWithFarewell} style={styles.btnDanger}>
                🚪 Logout
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === 'appearance' && isAdmin ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Appearance</h2>
                <p style={styles.cardSubtitle}>Choose the font used across the admin workspace.</p>
              </div>
              <div style={styles.roleChip}>Admin</div>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Application Font</label>
                <select value={selectedFont} onChange={handleFontChange} style={styles.input}>
                  {appFontOptions.map((fontOption) => (
                    <option key={fontOption.value} value={fontOption.value}>
                      {fontOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.fontPreviewCard}>
                <div style={styles.fontPreviewTitle}>Preview</div>
                <div style={styles.fontPreviewText}>
                  Rental dashboard, payments, reports, and settings.
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'users' && isAdmin ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Users</h2>
                <p style={styles.cardSubtitle}>Create staff accounts and assign their access level clearly.</p>
              </div>
              <div style={styles.roleChip}>Admin</div>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={newUserData.full_name}
                    onChange={handleNewUserChange}
                    placeholder="e.g. Jane Manager"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Username *</label>
                  <input
                    type="text"
                    name="username"
                    value={newUserData.username}
                    onChange={handleNewUserChange}
                    placeholder="e.g. jane"
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={newUserData.email}
                    onChange={handleNewUserChange}
                    placeholder="user@example.com"
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={newUserData.phone}
                    onChange={handleNewUserChange}
                    placeholder="e.g. +2507..."
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Role</label>
                  <select name="role" value={newUserData.role} onChange={handleNewUserChange} style={styles.input}>
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={newUserData.password}
                    onChange={handleNewUserChange}
                    required
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={newUserData.confirmPassword}
                    onChange={handleNewUserChange}
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <button type="submit" style={styles.btnPrimary} disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </form>

            <div style={styles.userListPanel}>
              <div style={styles.subHeaderRow}>
                <div>
                  <h3 style={styles.systemPanelTitle}>Admin User List</h3>
                  <p style={styles.systemActionText}>Disable access quickly or reset a staff password without touching the database.</p>
                </div>
                <button type="button" onClick={fetchUsers} style={styles.btnSecondary} disabled={usersLoading}>
                  {usersLoading ? 'Refreshing...' : 'Refresh Users'}
                </button>
              </div>

              <div style={styles.auditTableWrap}>
                <table style={styles.userTable}>
                  <thead>
                    <tr>
                      <th style={styles.auditTh}>User</th>
                      <th style={styles.auditTh}>Role</th>
                      <th style={styles.auditTh}>Status</th>
                      <th style={styles.auditTh}>Reset Password</th>
                      <th style={styles.auditTh}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan="5" style={styles.auditEmpty}>Loading users...</td>
                      </tr>
                    ) : userList.length ? (
                      userList.map((staffUser) => (
                        <tr key={staffUser.id}>
                          <td style={styles.auditTd}>
                            <div style={styles.auditActor}>{staffUser.full_name || staffUser.username}</div>
                            <div style={styles.auditMuted}>{staffUser.email || '-'}</div>
                            <div style={styles.auditMuted}>{staffUser.phone || '-'}</div>
                          </td>
                          <td style={styles.auditTd}>
                            <span style={styles.auditActionPill}>{staffUser.role || 'user'}</span>
                          </td>
                          <td style={styles.auditTd}>
                            <span style={{
                              ...styles.auditStatus,
                              ...(staffUser.is_active ? styles.auditStatusOk : styles.auditStatusDanger)
                            }}>
                              {staffUser.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td style={styles.auditTd}>
                            <div style={styles.inlineControlGroup}>
                              <input
                                type="password"
                                value={resetPasswords[staffUser.id] || ''}
                                onChange={(event) => setResetPasswords((prev) => ({
                                  ...prev,
                                  [staffUser.id]: event.target.value
                                }))}
                                placeholder="New password"
                                style={styles.compactInput}
                              />
                              <button
                                type="button"
                                onClick={() => handleResetUserPassword(staffUser)}
                                style={styles.btnSecondary}
                              >
                                Reset
                              </button>
                            </div>
                          </td>
                          <td style={styles.auditTd}>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(staffUser)}
                              style={staffUser.is_active ? styles.btnDanger : styles.btnPrimary}
                              disabled={staffUser.id === user?.id && staffUser.is_active}
                            >
                              {staffUser.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={styles.auditEmpty}>No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'audit' && isAdmin ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Audit Logs</h2>
                <p style={styles.cardSubtitle}>Review important logins, changes, exports, and failed requests.</p>
              </div>
              <div style={styles.auditActions}>
                <select
                  value={auditLimit}
                  onChange={(event) => setAuditLimit(Number(event.target.value))}
                  style={styles.auditSelect}
                  aria-label="Audit log limit"
                >
                  <option value={100}>Last 100</option>
                  <option value={200}>Last 200</option>
                  <option value={500}>Last 500</option>
                  <option value={1000}>Last 1000</option>
                </select>
                <button type="button" onClick={fetchAuditLogs} style={styles.btnSecondary} disabled={auditLoading}>
                  {auditLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            <div style={styles.auditSummaryGrid}>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Loaded Events</span>
                <strong style={styles.auditMetricValue}>{auditLogs.length}</strong>
              </div>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Write Actions</span>
                <strong style={styles.auditMetricValue}>{writeAuditCount}</strong>
              </div>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Needs Review</span>
                <strong style={styles.auditMetricValue}>{failedAuditCount}</strong>
              </div>
            </div>

            <div style={styles.auditTableWrap}>
              <table style={styles.auditTable}>
                <thead>
                  <tr>
                    <th style={styles.auditTh}>Time</th>
                    <th style={styles.auditTh}>Actor</th>
                    <th style={styles.auditTh}>Action</th>
                    <th style={styles.auditTh}>Request</th>
                    <th style={styles.auditTh}>Status</th>
                    <th style={styles.auditTh}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr>
                      <td colSpan="6" style={styles.auditEmpty}>Loading audit activity...</td>
                    </tr>
                  ) : auditLogs.length ? (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={styles.auditTd}>{formatAuditDate(log.created_at)}</td>
                        <td style={styles.auditTd}>
                          <div style={styles.auditActor}>{log.username || 'System'}</div>
                          <div style={styles.auditMuted}>{log.role || 'unknown'}</div>
                        </td>
                        <td style={styles.auditTd}>
                          <span style={styles.auditActionPill}>{log.action || '-'}</span>
                        </td>
                        <td style={styles.auditTd}>
                          <div style={styles.auditPath}>{log.method || '-'} {log.path || '-'}</div>
                          {log.details?.duration_ms !== undefined ? (
                            <div style={styles.auditMuted}>{log.details.duration_ms} ms</div>
                          ) : null}
                        </td>
                        <td style={styles.auditTd}>
                          <span style={{ ...styles.auditStatus, ...getAuditStatusStyle(Number(log.status_code)) }}>
                            {log.status_code || '-'}
                          </span>
                        </td>
                        <td style={styles.auditTd}>{log.ip_address || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={styles.auditEmpty}>No audit activity found yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'system' && isAdmin ? (
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>System Health</h2>
                <p style={styles.cardSubtitle}>Check encrypted backups and run a fresh backup before important changes.</p>
              </div>
              <div style={{
                ...styles.systemHealthBadge,
                ...(backupStatus?.health === 'healthy' ? styles.systemHealthGood : {}),
                ...(backupStatus?.health && backupStatus.health !== 'healthy' ? styles.systemHealthWarn : {})
              }}>
                {backupStatus?.health ? backupStatus.health.replace('-', ' ') : 'Not checked'}
              </div>
            </div>

            <div style={styles.systemActionGrid}>
              <div style={styles.systemActionCard}>
                <div>
                  <h3 style={styles.systemActionTitle}>Check Status</h3>
                  <p style={styles.systemActionText}>Refresh backup health without creating a new file.</p>
                </div>
                <button type="button" onClick={fetchBackupStatus} style={styles.btnSecondary} disabled={backupLoading}>
                  {backupLoading ? 'Checking...' : 'Check Status'}
                </button>
              </div>
              <div style={styles.systemActionCard}>
                <div>
                  <h3 style={styles.systemActionTitle}>Run Backup Now</h3>
                  <p style={styles.systemActionText}>Create a new encrypted database backup immediately.</p>
                </div>
                <button type="button" onClick={handleRunBackup} style={styles.btnPrimary} disabled={backupRunning}>
                  {backupRunning ? 'Running...' : 'Run Backup Now'}
                </button>
              </div>
              <div style={styles.systemActionCard}>
                <div>
                  <h3 style={styles.systemActionTitle}>Verify Latest</h3>
                  <p style={styles.systemActionText}>Decrypt-check the newest backup and confirm it is a valid database.</p>
                </div>
                <button type="button" onClick={handleVerifyBackup} style={styles.btnSecondary} disabled={backupVerifying || !latestBackup}>
                  {backupVerifying ? 'Verifying...' : 'Verify Latest'}
                </button>
              </div>
              <div style={styles.systemActionCard}>
                <div>
                  <h3 style={styles.systemActionTitle}>Prepare Restore</h3>
                  <p style={styles.systemActionText}>Validate a selected encrypted backup and stage it for the next backend restart.</p>
                </div>
                <select
                  value={restoreBackupName}
                  onChange={(event) => setRestoreBackupName(event.target.value)}
                  style={styles.auditSelect}
                  aria-label="Backup to restore"
                >
                  <option value="">Select backup</option>
                  {backupHistory.map((backup) => (
                    <option key={backup.name} value={backup.name}>{backup.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePrepareRestore}
                  style={styles.btnDanger}
                  disabled={restorePreparing || !restoreBackupName}
                >
                  {restorePreparing ? 'Preparing...' : 'Prepare Restore'}
                </button>
              </div>
            </div>

            <div style={styles.systemHealthNote}>{backupHealthText}</div>

            <div style={styles.auditSummaryGrid}>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Backup Status</span>
                <strong style={styles.auditMetricValue}>{backupStatus?.enabled ? 'On' : 'Off'}</strong>
              </div>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Encrypted</span>
                <strong style={styles.auditMetricValue}>{backupStatus?.encrypted ? 'Yes' : 'No'}</strong>
              </div>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Backup Count</span>
                <strong style={styles.auditMetricValue}>{backupStatus?.backup_count ?? '-'}</strong>
              </div>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Database</span>
                <strong style={styles.auditMetricValue}>{backupStatus?.database_found ? 'Found' : 'Missing'}</strong>
              </div>
              <div style={styles.auditMetric}>
                <span style={styles.auditMetricLabel}>Restore</span>
                <strong style={styles.auditMetricValue}>{backupStatus?.restore_pending ? 'Pending' : 'Clear'}</strong>
              </div>
            </div>

            <div style={styles.systemGrid}>
              <div style={styles.systemPanel}>
                <h3 style={styles.systemPanelTitle}>Latest Backup</h3>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>File</span>
                  <span style={styles.systemValue}>{latestBackup?.name || 'No backup yet'}</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Created</span>
                  <span style={styles.systemValue}>{formatAuditDate(latestBackup?.modified_at)}</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Size</span>
                  <span style={styles.systemValue}>{formatBytes(latestBackup?.size_bytes)}</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Age</span>
                  <span style={styles.systemValue}>{formatBackupAge(backupStatus?.latest_age_hours)}</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Verified</span>
                  <span style={styles.systemValue}>
                    {backupVerification?.verified ? `Yes - ${formatAuditDate(backupVerification.checked_at)}` : 'Not verified this session'}
                  </span>
                </div>
              </div>

              <div style={styles.systemPanel}>
                <h3 style={styles.systemPanelTitle}>Backup Policy</h3>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Directory</span>
                  <span style={styles.systemValue}>{backupStatus?.backup_directory || '-'}</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Keep</span>
                  <span style={styles.systemValue}>{backupStatus?.keep_count ?? '-'} backups</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Interval</span>
                  <span style={styles.systemValue}>{backupStatus?.interval_hours ?? '-'} hours</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Next Expected</span>
                  <span style={styles.systemValue}>
                    {backupStatus?.enabled
                      ? formatAuditDate(backupStatus?.next_backup_at)
                      : 'Automatic backups disabled'}
                  </span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Storage Used</span>
                  <span style={styles.systemValue}>{formatBytes(backupStatus?.storage_used_bytes)}</span>
                </div>
                <div style={styles.systemLine}>
                  <span style={styles.systemLabel}>Last Checked</span>
                  <span style={styles.systemValue}>{formatAuditDate(backupStatus?.checked_at)}</span>
                </div>
              </div>
            </div>

            <div style={styles.systemPanel}>
              <div style={styles.subHeaderRow}>
                <div>
                  <h3 style={styles.systemPanelTitle}>Email / SMS Production Setup</h3>
                  <p style={styles.systemActionText}>Recovery messages and OTP delivery need real providers before production use.</p>
                </div>
                <button type="button" onClick={fetchMessagingStatus} style={styles.btnSecondary} disabled={messagingLoading}>
                  {messagingLoading ? 'Checking...' : 'Check Messaging'}
                </button>
              </div>

              <div style={styles.auditSummaryGrid}>
                <div style={styles.auditMetric}>
                  <span style={styles.auditMetricLabel}>Email</span>
                  <strong style={styles.auditMetricValue}>
                    {messagingStatus?.email?.configured ? 'Ready' : 'Missing'}
                  </strong>
                  <div style={styles.auditMuted}>
                    {messagingStatus?.email?.configured
                      ? messagingStatus.email.from_email || messagingStatus.email.host
                      : (messagingStatus?.email?.missing || []).join(', ') || 'Not checked'}
                  </div>
                </div>
                <div style={styles.auditMetric}>
                  <span style={styles.auditMetricLabel}>SMS</span>
                  <strong style={styles.auditMetricValue}>
                    {messagingStatus?.sms?.configured ? 'Ready' : 'Missing'}
                  </strong>
                  <div style={styles.auditMuted}>
                    {messagingStatus?.sms?.configured
                      ? messagingStatus.sms.from_number
                      : (messagingStatus?.sms?.missing || []).join(', ') || 'Not checked'}
                  </div>
                </div>
                <div style={styles.auditMetric}>
                  <span style={styles.auditMetricLabel}>Login OTP</span>
                  <strong style={styles.auditMetricValue}>
                    {messagingStatus?.login_otp?.enabled ? 'On' : 'Off'}
                  </strong>
                  <div style={styles.auditMuted}>
                    Roles: {(messagingStatus?.login_otp?.roles || ['admin']).join(', ')}
                  </div>
                </div>
                <div style={styles.auditMetric}>
                  <span style={styles.auditMetricLabel}>WhatsApp</span>
                  <strong style={styles.auditMetricValue}>
                    {messagingStatus?.whatsapp?.enabled ? 'On' : 'Off'}
                  </strong>
                  <div style={styles.auditMuted}>
                    {messagingStatus?.whatsapp?.configured
                      ? 'Provider configured'
                      : (messagingStatus?.whatsapp?.missing || []).join(', ') || 'Not checked'}
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.systemPanel}>
              <h3 style={styles.systemPanelTitle}>Recent Backups</h3>
              <div style={styles.systemBackupList}>
                {backupHistory.length ? backupHistory.map((backup) => (
                  <div key={backup.name} style={styles.systemBackupRow}>
                    <div style={styles.systemBackupName}>{backup.name}</div>
                    <div style={styles.systemBackupMeta}>
                      <span>{formatAuditDate(backup.modified_at)}</span>
                      <span>{formatBytes(backup.size_bytes)}</span>
                    </div>
                  </div>
                )) : (
                  <div style={styles.auditEmpty}>No backup files found.</div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  headerIntro: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    marginBottom: '1.5rem',
    padding: '1.5rem',
    borderRadius: '1.1rem',
    background: 'linear-gradient(135deg, #0f172a 0%, #155e75 56%, #0f766e 100%)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 22px 46px rgba(15, 23, 42, 0.18)'
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  headerProfileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.5rem 0.65rem',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.35)',
    background: 'rgba(255, 255, 255, 0.16)',
    backdropFilter: 'blur(4px)'
  },
  headerProfileImage: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255, 255, 255, 0.8)'
  },
  headerProfilePlaceholder: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'rgba(15, 23, 42, 0.5)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.9rem',
    border: '2px solid rgba(255, 255, 255, 0.8)'
  },
  headerProfileText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: '0.86rem',
    maxWidth: '170px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
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
    margin: 0,
    color: '#ffffff',
    lineHeight: 1.1,
    textShadow: '0 2px 10px rgba(15, 23, 42, 0.28)'
  },
  subtitle: {
    margin: 0,
    color: '#dbeafe',
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: 1.55
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '1rem 1.1rem',
    borderRadius: '0.85rem',
    marginBottom: '1rem'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '1rem 1.1rem',
    borderRadius: '0.85rem',
    marginBottom: '1rem'
  },
  container: {
    display: 'grid',
    gridTemplateColumns: '220px minmax(0, 1fr)',
    gap: '1.5rem',
    alignItems: 'start'
  },
  tabsPanel: {
    background: '#ffffff',
    border: '1px solid #dbe4f0',
    borderRadius: '1rem',
    padding: '1rem',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.05)',
    position: 'sticky',
    top: '88px'
  },
  tabsPanelTitle: {
    color: '#0f172a',
    fontSize: '1rem',
    fontWeight: '800',
    marginBottom: '0.35rem'
  },
  tabsPanelText: {
    color: '#64748b',
    fontSize: '0.88rem',
    lineHeight: 1.5,
    marginBottom: '0.9rem'
  },
  tabs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem'
  },
  tabsProfileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.7rem',
    borderRadius: '0.9rem',
    background: '#f8fafc',
    border: '1px solid #dbe4f0',
    marginBottom: '0.85rem'
  },
  tabsProfileImage: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #dbeafe',
    flexShrink: 0
  },
  tabsProfilePlaceholder: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.92rem',
    flexShrink: 0
  },
  tabsProfileMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  tabsProfileName: {
    color: '#0f172a',
    fontSize: '0.82rem',
    fontWeight: '800',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabsProfileEmail: {
    color: '#64748b',
    fontSize: '0.74rem',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tab: {
    padding: '0.8rem 0.9rem',
    border: '1px solid #e2e8f0',
    borderRadius: '0.9rem',
    cursor: 'pointer',
    fontWeight: '600',
    color: '#1f2937',
    transition: 'all 0.2s ease',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    textAlign: 'left'
  },
  tabActive: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    borderColor: '#2563eb',
    boxShadow: '0 14px 24px rgba(37, 99, 235, 0.2)'
  },
  tabIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.14)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    flexShrink: 0
  },
  tabTextBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem'
  },
  tabLabel: {
    fontSize: '0.92rem',
    fontWeight: '700'
  },
  tabHint: {
    fontSize: '0.76rem',
    opacity: 0.85
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '1.6rem',
    borderRadius: '1rem',
    border: '1px solid #dbe4f0',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1.25rem'
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    margin: 0,
    color: '#1f2937'
  },
  cardSubtitle: {
    margin: '0.35rem 0 0 0',
    color: '#64748b',
    lineHeight: 1.5,
    fontSize: '0.92rem'
  },
  roleChip: {
    padding: '0.5rem 0.8rem',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '0.8rem',
    fontWeight: '800',
    textTransform: 'capitalize'
  },
  infoChip: {
    padding: '0.5rem 0.8rem',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#4338ca',
    fontSize: '0.8rem',
    fontWeight: '800'
  },
  profileHero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
    marginBottom: '1.4rem'
  },
  profilePreviewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '1rem',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dbe4f0'
  },
  profileImageWrap: {
    width: '84px',
    height: '84px',
    flexShrink: 0
  },
  profileImage: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #dbeafe'
  },
  profilePlaceholder: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.85rem',
    fontWeight: '700'
  },
  profileMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  profileName: {
    color: '#0f172a',
    fontSize: '1rem',
    fontWeight: '800'
  },
  profileEmail: {
    color: '#64748b',
    fontSize: '0.9rem'
  },
  uploadCard: {
    padding: '1rem',
    borderRadius: '1rem',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem'
  },
  uploadCardTitle: {
    color: '#334155',
    fontSize: '0.88rem',
    fontWeight: '800'
  },
  fileName: {
    color: '#64748b',
    fontSize: '0.88rem'
  },
  uploadPreviewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transformOrigin: 'center center',
    willChange: 'transform'
  },
  cropPreviewFrame: {
    width: '220px',
    height: '220px',
    borderRadius: '0.9rem',
    border: '1px solid #dbe4f0',
    overflow: 'hidden',
    background: '#ffffff'
  },
  cropControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    maxWidth: '320px'
  },
  cropControlRow: {
    display: 'grid',
    gridTemplateColumns: '90px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '0.55rem'
  },
  cropLabel: {
    margin: 0,
    color: '#475569',
    fontSize: '0.8rem',
    fontWeight: '700'
  },
  cropSlider: {
    width: '100%'
  },
  cropResetButton: {
    alignSelf: 'flex-start',
    marginTop: '0.3rem',
    padding: '0.4rem 0.7rem',
    borderRadius: '0.7rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#1e293b',
    fontSize: '0.78rem',
    fontWeight: '700',
    cursor: 'pointer'
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    width: 1,
    height: 1
  },
  uploadControls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem'
  },
  fileSelectButton: {
    padding: '0.75rem 1rem',
    borderRadius: '0.8rem',
    background: '#ffffff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  formGroup: {
    marginBottom: '1rem'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem'
  },
  label: {
    display: 'block',
    marginBottom: '0.45rem',
    color: '#334155',
    fontSize: '0.88rem',
    fontWeight: '700'
  },
  input: {
    width: '100%',
    minHeight: '48px',
    boxSizing: 'border-box',
    borderRadius: '0.85rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    padding: '0 0.95rem',
    fontSize: '0.94rem',
    outline: 'none',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
  },
  fontPreviewCard: {
    minHeight: '112px',
    borderRadius: '0.95rem',
    border: '1px solid #dbe4f0',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '0.45rem'
  },
  fontPreviewTitle: {
    color: '#0f172a',
    fontSize: '0.9rem',
    fontWeight: '900'
  },
  fontPreviewText: {
    color: '#334155',
    fontSize: '1rem',
    lineHeight: 1.55,
    fontWeight: '650'
  },
  btnPrimary: {
    marginTop: '0.35rem',
    padding: '0.85rem 1.35rem',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700',
    boxShadow: '0 14px 24px rgba(37, 99, 235, 0.18)'
  },
  btnSecondary: {
    padding: '0.75rem 1rem',
    backgroundColor: '#0f766e',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.8rem',
    cursor: 'pointer',
    fontWeight: '700'
  },
  btnDanger: {
    padding: '0.85rem 1.35rem',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    fontWeight: '700'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.9rem',
    marginBottom: '1.4rem'
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    padding: '1rem',
    borderRadius: '0.9rem',
    border: '1px solid #e2e8f0'
  },
  infoLabel: {
    color: '#64748b',
    fontSize: '0.78rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.4rem'
  },
  infoValue: {
    color: '#0f172a',
    fontSize: '0.96rem',
    fontWeight: '700',
    lineHeight: 1.45
  },
  logoutSection: {
    background: '#fff7f7',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid #fecaca'
  },
  logoutTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    margin: '0 0 0.45rem 0',
    color: '#1f2937'
  },
  logoutText: {
    color: '#6b7280',
    margin: '0 0 1rem 0'
  },
  auditActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'wrap'
  },
  subHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1rem'
  },
  userListPanel: {
    marginTop: '1.5rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid #e2e8f0'
  },
  userTable: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '980px',
    background: '#ffffff'
  },
  inlineControlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap'
  },
  compactInput: {
    minWidth: '180px',
    minHeight: '40px',
    boxSizing: 'border-box',
    borderRadius: '0.75rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    padding: '0 0.8rem',
    fontSize: '0.86rem',
    outline: 'none'
  },
  auditSelect: {
    minHeight: '42px',
    borderRadius: '0.8rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    padding: '0 0.85rem',
    fontWeight: '700',
    outline: 'none'
  },
  auditSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '0.85rem',
    marginBottom: '1rem'
  },
  auditMetric: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.9rem',
    padding: '1rem'
  },
  auditMetricLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '0.78rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.35rem'
  },
  auditMetricValue: {
    display: 'block',
    color: '#0f172a',
    fontSize: '1.35rem',
    lineHeight: 1
  },
  auditTableWrap: {
    overflowX: 'auto',
    borderRadius: '0.95rem',
    border: '1px solid #e2e8f0'
  },
  auditTable: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '860px',
    background: '#ffffff'
  },
  auditTh: {
    background: '#f8fafc',
    color: '#334155',
    fontSize: '0.76rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
    padding: '0.85rem',
    borderBottom: '1px solid #e2e8f0'
  },
  auditTd: {
    color: '#1f2937',
    fontSize: '0.86rem',
    padding: '0.85rem',
    borderBottom: '1px solid #edf2f7',
    verticalAlign: 'top'
  },
  auditActor: {
    color: '#0f172a',
    fontWeight: '800'
  },
  auditMuted: {
    color: '#64748b',
    fontSize: '0.78rem',
    marginTop: '0.18rem'
  },
  auditPath: {
    color: '#334155',
    fontWeight: '700',
    lineHeight: 1.35,
    wordBreak: 'break-word'
  },
  auditActionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '230px',
    padding: '0.35rem 0.55rem',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    fontSize: '0.76rem',
    fontWeight: '900',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere'
  },
  auditStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '44px',
    minHeight: '28px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: '900'
  },
  auditStatusOk: {
    background: '#dcfce7',
    color: '#166534'
  },
  auditStatusWarn: {
    background: '#fef3c7',
    color: '#92400e'
  },
  auditStatusDanger: {
    background: '#fee2e2',
    color: '#991b1b'
  },
  auditStatusMuted: {
    background: '#e2e8f0',
    color: '#475569'
  },
  auditEmpty: {
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'center',
    padding: '1.4rem'
  },
  systemGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  },
  systemActionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '0.9rem',
    marginBottom: '1rem'
  },
  systemActionCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '0.9rem',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dbe4f0',
    borderRadius: '0.95rem',
    padding: '1rem',
    boxShadow: '0 12px 22px rgba(15, 23, 42, 0.04)'
  },
  systemActionTitle: {
    margin: '0 0 0.35rem 0',
    color: '#0f172a',
    fontSize: '0.98rem',
    fontWeight: '900'
  },
  systemActionText: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.85rem',
    lineHeight: 1.45,
    fontWeight: '650'
  },
  systemHealthBadge: {
    padding: '0.55rem 0.8rem',
    borderRadius: '999px',
    background: '#e2e8f0',
    color: '#475569',
    fontSize: '0.78rem',
    fontWeight: '900',
    textTransform: 'capitalize',
    border: '1px solid #cbd5e1'
  },
  systemHealthGood: {
    background: '#dcfce7',
    color: '#166534',
    borderColor: '#86efac'
  },
  systemHealthWarn: {
    background: '#fef3c7',
    color: '#92400e',
    borderColor: '#fcd34d'
  },
  systemHealthNote: {
    color: '#334155',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.9rem',
    padding: '0.9rem 1rem',
    fontSize: '0.9rem',
    fontWeight: '750',
    marginBottom: '1rem',
    lineHeight: 1.45
  },
  systemPanel: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.95rem',
    padding: '1rem'
  },
  systemPanelTitle: {
    margin: '0 0 0.85rem 0',
    color: '#0f172a',
    fontSize: '1rem',
    fontWeight: '900'
  },
  systemLine: {
    display: 'grid',
    gridTemplateColumns: '110px minmax(0, 1fr)',
    gap: '0.75rem',
    padding: '0.65rem 0',
    borderTop: '1px solid #e2e8f0',
    alignItems: 'start'
  },
  systemLabel: {
    color: '#64748b',
    fontSize: '0.78rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  systemValue: {
    color: '#0f172a',
    fontSize: '0.88rem',
    fontWeight: '800',
    overflowWrap: 'anywhere',
    lineHeight: 1.4
  },
  systemBackupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem'
  },
  systemBackupRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '0.8rem',
    borderRadius: '0.8rem',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  systemBackupName: {
    color: '#0f172a',
    fontSize: '0.86rem',
    fontWeight: '850',
    overflowWrap: 'anywhere'
  },
  systemBackupMeta: {
    display: 'flex',
    gap: '0.75rem',
    color: '#64748b',
    fontSize: '0.78rem',
    fontWeight: '800',
    flexWrap: 'wrap'
  }
};

export default Settings;
