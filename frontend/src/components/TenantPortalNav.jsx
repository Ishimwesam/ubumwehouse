import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { tenantPortalService } from '../services/api';
import { emitAppToast } from '../context/ToastContext';
import useTenantUnread from '../hooks/useTenantUnread';
import {
  clearUnread,
  incrementUnread,
  registerTenantPushSubscription,
  requestNotificationPermission,
  showBrowserNotification
} from '../utils/tenantNotification';

const seenRealtimeIds = new Set();

const BellGlyph = () => (
  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

const NavIcon = ({ children }) => (
  <span className="tp-nav-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      {children}
    </svg>
  </span>
);

const icons = {
  dashboard: (
    <NavIcon>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </NavIcon>
  ),
  payments: (
    <NavIcon>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M4 9h16M7 15h4" />
    </NavIcon>
  ),
  history: (
    <NavIcon>
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 4v5h5M12 8v5l3 2" />
    </NavIcon>
  ),
  upload: (
    <NavIcon>
      <path d="M6 20h12a2 2 0 0 0 2-2v-3M12 4v11M8 8l4-4 4 4" />
    </NavIcon>
  ),
  maintenance: (
    <NavIcon>
      <path d="m14.7 6.3 3 3M4 20l4.4-1.1L18.7 8.6a2.1 2.1 0 0 0-3-3L5.4 15.9z" />
      <path d="M12.5 7.5 16.5 11.5" />
    </NavIcon>
  ),
  messages: (
    <NavIcon>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4.2A2.5 2.5 0 0 1 5 12.5z" />
    </NavIcon>
  ),
  announcements: (
    <NavIcon>
      <path d="M4 11v2a2 2 0 0 0 2 2h2l7 4V5L8 9H6a2 2 0 0 0-2 2z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
    </NavIcon>
  ),
  profile: (
    <NavIcon>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" />
    </NavIcon>
  ),
  password: (
    <NavIcon>
      <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />
    </NavIcon>
  ),
  documents: (
    <NavIcon>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M9.5 12h5M9.5 16h7" />
    </NavIcon>
  ),
  lease: (
    <NavIcon>
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </NavIcon>
  ),
  support: (
    <NavIcon>
      <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h4M4 12h4v7H6a2 2 0 0 1-2-2z" />
    </NavIcon>
  )
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/tenant-portal' },
  { id: 'messages', label: 'Messages', path: '/tenant-portal/messages' },
  { id: 'payments', label: 'Payments', path: '/tenant-portal/payments' },
  { id: 'history', label: 'Payment History', shortLabel: 'History', path: '/tenant-portal/payments#history', extra: true },
  { id: 'maintenance', label: 'Maintenance', path: '/tenant-portal/maintenance' },
  { id: 'documents', label: 'Documents & Receipts', shortLabel: 'Docs', path: '/tenant-portal/payments#receipts', extra: true },
  { id: 'lease', label: 'My Lease', shortLabel: 'Lease', path: '/tenant-portal/profile#lease', extra: true },
  { id: 'profile', label: 'Profile', path: '/tenant-portal/profile' },
  { id: 'support', label: 'Support', path: '/tenant-portal/messages#support', extra: true },
  { id: 'upload', label: 'Upload Receipt', shortLabel: 'Upload', path: '/tenant-portal/upload#receipt', extra: true },
  { id: 'announcements', label: 'Announcements', shortLabel: 'Notices', path: '/tenant-portal/announcements#notices', extra: true },
  { id: 'password', label: 'Change Password', shortLabel: 'Password', path: '/tenant-portal/profile#password', extra: true }
];

const LANGUAGE_STORAGE_KEY = 'tenantPortalLanguage';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Francais' },
  { code: 'rw', label: 'Kinyarwanda' }
];

const navTranslations = {
  en: {
    dashboard: 'Home',
    payments: 'Payments',
    history: 'History',
    upload: 'Receipt',
    maintenance: 'Maintenance',
    messages: 'Messages',
    announcements: 'Notices',
    documents: 'Documents & Receipts',
    lease: 'My Lease',
    support: 'Support',
    profile: 'Profile',
    password: 'Password',
    alertsOn: 'Alerts On',
    enableAlerts: 'Enable Alerts',
    enabling: 'Enabling...',
    language: 'Language',
    rentPaid: 'Rent paid',
    rentPaidMessage: 'Your rent for {period} is fully paid.',
    rentOverdue: 'Rent overdue',
    rentOverdueMessage: 'Your rent was due on {date}. Please upload your payment receipt.',
    rentDueToday: 'Rent due today',
    rentDueTodayMessage: 'Your rent is due today. Please upload your payment receipt after paying.',
    rentDueReminder: 'Rent due reminder',
    rentDueReminderMessage: 'Your rent is due on {date}.',
    currentPeriod: 'Current period',
    pendingConfirmation: '{amount} is waiting for admin confirmation.',
    dueAmount: 'Due amount',
    dueDate: 'Due date',
    uploadReceipt: 'Upload Receipt',
    monthlyRent: 'Monthly Rent',
    paidAmount: 'Paid Amount',
    outstandingBalance: 'Outstanding Balance',
    paymentHistory: 'Payment History',
    paymentHistorySubtitle: 'All receipts and payment records for your tenant portal account.',
    totalPaid: 'Total Paid',
    lastPaymentDate: 'Last Payment Date',
    pendingPayments: 'Pending Payments',
    backToDashboard: 'Back To Dashboard',
    uploadNewReceipt: 'Upload New Receipt',
    downloadStatement: 'Download Statement',
    contactAdmin: 'Contact Admin',
    paymentsTitle: 'Payments',
    homePriority: 'Your Home, Our Priority',
    welcomeBack: 'Welcome back, {name}!',
    tenancySummary: "Here's what's happening with your tenancy.",
    notifications: 'Notifications',
    rentDueInDays: 'Your rent is due in {days} days.',
    rentDueTodayBanner: 'Your rent is due today.',
    rentOverdueBanner: 'Your rent is overdue.',
    avoidLateFees: 'Please make your payment to avoid late fees.',
    payRentNow: 'Pay Rent Now',
    currentBalance: 'Current Balance',
    nextPaymentAmount: 'Next Payment Amount',
    nextPaymentDue: 'Next Payment Due',
    nextPaymentMessage: 'Your next rent payment is due on {date}.',
    daysRemaining: '{days} days remaining',
    property: 'Property',
    viewDetails: 'View Details',
    makePayment: 'Make a Payment',
    viewMyLease: 'View My Lease',
    quickActions: 'Quick Actions',
    payRent: 'Pay Rent',
    securePayment: 'Make a secure payment',
    viewPayments: 'View your payments',
    maintenanceRequest: 'Maintenance',
    reportIssue: 'Report an issue',
    documentsReceipts: 'Documents & Receipts',
    viewDownload: 'View and download',
    sendViewMessages: 'Send or view messages',
    profileInfo: 'My information',
    announcementsTitle: 'Announcements',
    upcomingPayment: 'Upcoming Payment',
    recentPayments: 'Recent Payments',
    viewAll: 'View All',
    viewAllPayments: 'View All Payments',
    needHelp: 'Need Help?',
    hereForYou: "We're here for you",
    secureProtected: 'Your information is secure and protected.',
    noAnnouncements: 'No announcements yet.',
    noRecentPayments: 'No recent payments yet.',
    paid: 'Paid',
    rentForPeriod: 'Rent for {period}',
    houseNo: 'House No. {unit}',
    cityCountry: 'Kigali, Rwanda',
    uploadPaymentReceipt: 'Upload Payment Receipt',
    uploadPaymentSubtitle: 'Bank deposit receipts for UBUMWE HOUSE LTD payment confirmation.',
    receiptDetails: 'Receipt Details',
    loadingAccountDetails: 'Loading account details...',
    amount: 'Amount',
    paymentDate: 'Payment Date',
    paymentPeriod: 'Payment Period',
    method: 'Method',
    bankDeposit: 'Bank Deposit',
    mobileMoney: 'Mobile Money',
    cash: 'Cash',
    check: 'Check',
    receiptFile: 'Receipt image or PDF',
    notes: 'Notes',
    uploading: 'Uploading...',
    submitProof: 'Submit Proof',
    updateProof: 'Update Proof',
    editingReceiptNotice: 'Editing rejected/pending receipt. Saving will resend it for staff confirmation.',
    keepCurrentReceipt: 'Leave empty to keep the current receipt file.',
    contactManagement: 'Contact Management',
    helpSupport: 'Help & Support',
    settings: 'Settings',
    privacySecurity: 'Privacy & Security',
    receipts: 'Receipts',
    tenantLabel: 'Tenant',
    unit: 'Unit',
    uploadReceiptRequired: 'Upload a receipt image or PDF before submitting proof.',
    paymentProofUploaded: 'Payment proof uploaded successfully.',
    failedLoadTenantAccount: 'Failed to load tenant account.',
    failedUploadPaymentProof: 'Failed to upload payment proof.',
    rentMonth: 'Rent Month',
    amountPaid: 'Amount Paid',
    paymentMethod: 'Payment Method',
    transactionReference: 'Transaction Reference',
    paymentStatus: 'Payment Status',
    receipt: 'Receipt',
    rejectionReason: 'Rejection Reason',
    loadingPaymentHistory: 'Loading payment history...',
    reason: 'Reason',
    noRejectionReason: 'No reason was recorded. Please contact admin.',
    rejectedOn: 'Rejected {date}',
    viewDownloadReceipt: 'View / Download',
    noPaymentHistoryYet: 'No payment history yet.',
    failedLoadPaymentHistory: 'Failed to load payment history.',
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    partial: 'Partial',
    overpaid: 'Overpaid',
    maintenanceTitle: 'Maintenance Requests',
    maintenanceSubtitle: 'UBUMWE HOUSE LTD maintenance support and request tracking.',
    updateRequest: 'Update Request',
    createRequest: 'Create Request',
    cancelEdit: 'Cancel Edit',
    title: 'Title',
    category: 'Category',
    priority: 'Priority',
    description: 'Description',
    general: 'General',
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    cleaning: 'Cleaning',
    security: 'Security',
    appliance: 'Appliance',
    normal: 'Normal',
    low: 'Low',
    urgent: 'Urgent',
    maintenanceTitlePlaceholder: 'Example: Water leak in bathroom',
    maintenanceDescriptionPlaceholder: 'Describe the issue, location, and any timing details.',
    submitRequest: 'Submit Request',
    submitting: 'Submitting...',
    updating: 'Updating...',
    requestHistory: 'Request History',
    loadingRequests: 'Loading requests...',
    noMaintenanceRequests: 'No maintenance requests yet.',
    edit: 'Edit',
    delete: 'Delete',
    deleting: 'Deleting...',
    deleteOpenRequestConfirm: 'Delete this open maintenance request?',
    addTitleDescription: 'Add a title and description before submitting.',
    maintenanceUpdated: 'Maintenance request updated.',
    maintenanceSubmitted: 'Maintenance request submitted. Staff can now track it in portal control.',
    maintenanceDeleted: 'Maintenance request deleted.',
    failedLoadMaintenance: 'Failed to load maintenance requests.',
    failedUpdateMaintenance: 'Failed to update maintenance request.',
    failedSubmitMaintenance: 'Failed to submit maintenance request.',
    failedDeleteMaintenance: 'Failed to delete maintenance request.',
    messagesTitle: 'Messages',
    messagesSubtitle: 'Chat with UBUMWE HOUSE LTD support team.',
    roomOffice: 'Room / Office',
    status: 'Status',
    inboxState: 'Inbox State',
    unread: 'Unread',
    empty: 'Empty',
    supportChat: 'Support Chat',
    loadingMessages: 'Loading messages...',
    noMessagesYet: 'No messages yet. Start a conversation.',
    you: 'You',
    admin: 'Admin',
    messagePlaceholder: 'Type your message...',
    sending: 'Sending...',
    sendMessage: 'Send Message',
    failedLoadPortalDetails: 'Failed to load tenant portal details.',
    failedLoadMessages: 'Failed to load messages.',
    failedSendMessage: 'Failed to send message.',
    latestUpdates: 'Latest Updates',
    announcementsSubtitle: 'Official UBUMWE HOUSE LTD updates for tenants.',
    loadingAnnouncements: 'Loading announcements...',
    noAnnouncementsLong: 'No announcements yet. New notices from UBUMWE HOUSE LTD will appear on this page.',
    expires: 'Expires',
    failedLoadAnnouncements: 'Failed to load announcements.',
    profileSubtitle: 'Tenant account information linked to UBUMWE HOUSE LTD.',
    tenantDetails: 'Tenant Details',
    loadingProfile: 'Loading profile...',
    tenantName: 'Tenant Name',
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    building: 'Building',
    failedLoadProfile: 'Failed to load profile.',
    logout: 'Logout'
  },
  fr: {
    dashboard: 'Accueil',
    payments: 'Paiements',
    history: 'Historique',
    upload: 'Recu',
    maintenance: 'Reparer',
    messages: 'Messages',
    announcements: 'Avis',
    documents: 'Documents et recus',
    lease: 'Mon bail',
    support: 'Support',
    profile: 'Profil',
    password: 'Mot passe',
    alertsOn: 'Alertes',
    enableAlerts: 'Activer',
    enabling: 'Activation...',
    language: 'Langue',
    rentPaid: 'Loyer paye',
    rentPaidMessage: 'Votre loyer pour {period} est entierement paye.',
    rentOverdue: 'Loyer en retard',
    rentOverdueMessage: 'Votre loyer etait du le {date}. Veuillez televerser le recu de paiement.',
    rentDueToday: 'Loyer du aujourd hui',
    rentDueTodayMessage: 'Votre loyer est du aujourd hui. Veuillez televerser le recu apres paiement.',
    rentDueReminder: 'Rappel de loyer',
    rentDueReminderMessage: 'Votre loyer est du le {date}.',
    currentPeriod: 'Periode actuelle',
    pendingConfirmation: '{amount} attend la confirmation de l admin.',
    dueAmount: 'Montant du',
    dueDate: 'Date due',
    uploadReceipt: 'Televerser recu',
    monthlyRent: 'Loyer mensuel',
    paidAmount: 'Montant paye',
    outstandingBalance: 'Solde restant',
    paymentHistory: 'Historique paiements',
    paymentHistorySubtitle: 'Tous les recus et paiements de votre compte locataire.',
    totalPaid: 'Total paye',
    lastPaymentDate: 'Dernier paiement',
    pendingPayments: 'Paiements en attente',
    backToDashboard: 'Retour',
    uploadNewReceipt: 'Nouveau recu',
    downloadStatement: 'Telecharger releve',
    contactAdmin: 'Contacter admin',
    paymentsTitle: 'Paiements',
    homePriority: 'Votre maison, notre priorite',
    welcomeBack: 'Bon retour, {name}!',
    tenancySummary: 'Voici ce qui se passe avec votre location.',
    notifications: 'Notifications',
    rentDueInDays: 'Votre loyer est du dans {days} jours.',
    rentDueTodayBanner: 'Votre loyer est du aujourd hui.',
    rentOverdueBanner: 'Votre loyer est en retard.',
    avoidLateFees: 'Veuillez payer pour eviter les frais de retard.',
    payRentNow: 'Payer maintenant',
    currentBalance: 'Solde actuel',
    nextPaymentAmount: 'Montant prochain paiement',
    nextPaymentDue: 'Prochain paiement',
    nextPaymentMessage: 'Votre prochain paiement de loyer est du le {date}.',
    daysRemaining: '{days} jours restants',
    property: 'Propriete',
    viewDetails: 'Voir details',
    makePayment: 'Faire un paiement',
    viewMyLease: 'Voir mon bail',
    quickActions: 'Actions rapides',
    payRent: 'Payer loyer',
    securePayment: 'Paiement securise',
    viewPayments: 'Voir vos paiements',
    maintenanceRequest: 'Demande maintenance',
    reportIssue: 'Signaler un probleme',
    documentsReceipts: 'Documents et recus',
    viewDownload: 'Voir et telecharger',
    sendViewMessages: 'Envoyer ou voir messages',
    profileInfo: 'Mes informations',
    announcementsTitle: 'Annonces',
    upcomingPayment: 'Paiement a venir',
    recentPayments: 'Paiements recents',
    viewAll: 'Voir tout',
    viewAllPayments: 'Voir tous paiements',
    needHelp: 'Besoin d aide?',
    hereForYou: 'Nous sommes la pour vous',
    secureProtected: 'Vos informations sont securisees et protegees.',
    noAnnouncements: 'Aucune annonce pour le moment.',
    noRecentPayments: 'Aucun paiement recent.',
    paid: 'Paye',
    rentForPeriod: 'Loyer pour {period}',
    houseNo: 'Maison No. {unit}',
    cityCountry: 'Kigali, Rwanda',
    uploadPaymentReceipt: 'Televerser recu',
    uploadPaymentSubtitle: 'Recus de depot bancaire pour confirmation du paiement UBUMWE HOUSE LTD.',
    receiptDetails: 'Details du recu',
    loadingAccountDetails: 'Chargement du compte...',
    amount: 'Montant',
    paymentDate: 'Date paiement',
    paymentPeriod: 'Periode paiement',
    method: 'Methode',
    bankDeposit: 'Depot bancaire',
    mobileMoney: 'Mobile Money',
    cash: 'Especes',
    check: 'Cheque',
    receiptFile: 'Image ou PDF du recu',
    notes: 'Notes',
    uploading: 'Televersement...',
    submitProof: 'Envoyer preuve',
    updateProof: 'Modifier preuve',
    editingReceiptNotice: 'Modification du recu rejete/en attente. Il sera renvoye pour confirmation.',
    keepCurrentReceipt: 'Laissez vide pour garder le fichier actuel.',
    contactManagement: 'Contacter gestion',
    helpSupport: 'Aide et support',
    settings: 'Parametres',
    privacySecurity: 'Confidentialite',
    receipts: 'Recus',
    tenantLabel: 'Locataire',
    unit: 'Unite',
    uploadReceiptRequired: 'Ajoutez une image ou un PDF du recu avant d envoyer.',
    paymentProofUploaded: 'Preuve de paiement envoyee avec succes.',
    failedLoadTenantAccount: 'Impossible de charger le compte locataire.',
    failedUploadPaymentProof: 'Impossible d envoyer la preuve de paiement.',
    rentMonth: 'Mois loyer',
    amountPaid: 'Montant paye',
    paymentMethod: 'Methode paiement',
    transactionReference: 'Reference transaction',
    paymentStatus: 'Statut paiement',
    receipt: 'Recu',
    rejectionReason: 'Raison rejet',
    loadingPaymentHistory: 'Chargement historique...',
    reason: 'Raison',
    noRejectionReason: 'Aucune raison enregistree. Contactez admin.',
    rejectedOn: 'Rejete {date}',
    viewDownloadReceipt: 'Voir / Telecharger',
    noPaymentHistoryYet: 'Aucun historique de paiement.',
    failedLoadPaymentHistory: 'Impossible de charger l historique de paiement.',
    approved: 'Approuve',
    pending: 'En attente',
    rejected: 'Rejete',
    partial: 'Partiel',
    overpaid: 'Trop paye',
    maintenanceTitle: 'Demandes maintenance',
    maintenanceSubtitle: 'Support maintenance UBUMWE HOUSE LTD et suivi des demandes.',
    updateRequest: 'Modifier demande',
    createRequest: 'Creer demande',
    cancelEdit: 'Annuler',
    title: 'Titre',
    category: 'Categorie',
    priority: 'Priorite',
    description: 'Description',
    general: 'General',
    plumbing: 'Plomberie',
    electrical: 'Electricite',
    cleaning: 'Nettoyage',
    security: 'Securite',
    appliance: 'Appareil',
    normal: 'Normal',
    low: 'Bas',
    urgent: 'Urgent',
    maintenanceTitlePlaceholder: 'Exemple: fuite d eau dans la salle de bain',
    maintenanceDescriptionPlaceholder: 'Decrivez le probleme, le lieu et le moment.',
    submitRequest: 'Envoyer demande',
    submitting: 'Envoi...',
    updating: 'Mise a jour...',
    requestHistory: 'Historique demandes',
    loadingRequests: 'Chargement demandes...',
    noMaintenanceRequests: 'Aucune demande maintenance.',
    edit: 'Modifier',
    delete: 'Supprimer',
    deleting: 'Suppression...',
    deleteOpenRequestConfirm: 'Supprimer cette demande ouverte?',
    addTitleDescription: 'Ajoutez un titre et une description avant d envoyer.',
    maintenanceUpdated: 'Demande maintenance mise a jour.',
    maintenanceSubmitted: 'Demande maintenance envoyee. Le personnel peut la suivre.',
    maintenanceDeleted: 'Demande maintenance supprimee.',
    failedLoadMaintenance: 'Impossible de charger les demandes maintenance.',
    failedUpdateMaintenance: 'Impossible de modifier la demande maintenance.',
    failedSubmitMaintenance: 'Impossible d envoyer la demande maintenance.',
    failedDeleteMaintenance: 'Impossible de supprimer la demande maintenance.',
    messagesTitle: 'Messages',
    messagesSubtitle: 'Discutez avec le support UBUMWE HOUSE LTD.',
    roomOffice: 'Chambre / Bureau',
    status: 'Statut',
    inboxState: 'Etat boite',
    unread: 'Non lus',
    empty: 'Vide',
    supportChat: 'Chat support',
    loadingMessages: 'Chargement messages...',
    noMessagesYet: 'Aucun message. Commencez une conversation.',
    you: 'Vous',
    admin: 'Admin',
    messagePlaceholder: 'Tapez votre message...',
    sending: 'Envoi...',
    sendMessage: 'Envoyer message',
    failedLoadPortalDetails: 'Impossible de charger les details du portail.',
    failedLoadMessages: 'Impossible de charger les messages.',
    failedSendMessage: 'Impossible d envoyer le message.',
    latestUpdates: 'Dernieres mises a jour',
    announcementsSubtitle: 'Mises a jour officielles UBUMWE HOUSE LTD pour locataires.',
    loadingAnnouncements: 'Chargement annonces...',
    noAnnouncementsLong: 'Aucune annonce. Les nouveaux avis UBUMWE HOUSE LTD apparaitront ici.',
    expires: 'Expire',
    failedLoadAnnouncements: 'Impossible de charger les annonces.',
    profileSubtitle: 'Informations du compte locataire lie a UBUMWE HOUSE LTD.',
    tenantDetails: 'Details locataire',
    loadingProfile: 'Chargement profil...',
    tenantName: 'Nom locataire',
    company: 'Societe',
    email: 'Email',
    phone: 'Telephone',
    building: 'Batiment',
    unit: 'Unite',
    failedLoadProfile: 'Impossible de charger le profil.',
    logout: 'Deconnexion'
  },
  rw: {
    dashboard: 'Ahabanza',
    payments: 'Kwishyura',
    history: 'Amateka',
    upload: 'Risiti',
    maintenance: 'Gusana',
    messages: 'Ubutumwa',
    announcements: 'Amatangazo',
    documents: 'Inyandiko na risiti',
    lease: 'Amasezerano',
    support: 'Ubufasha',
    profile: 'Umwirondoro',
    password: 'Ijambo',
    alertsOn: 'Birakora',
    enableAlerts: 'Fungura',
    enabling: 'Tegereza...',
    language: 'Ururimi',
    rentPaid: 'Ubukode bwishyuwe',
    rentPaidMessage: 'Ubukode bwa {period} bwishyuwe bwose.',
    rentOverdue: 'Ubukode bwararenze',
    rentOverdueMessage: 'Ubukode bwagombaga kwishyurwa ku wa {date}. Ohereza risiti y ubwishyu.',
    rentDueToday: 'Ubukode ni uyu munsi',
    rentDueTodayMessage: 'Ubukode bugomba kwishyurwa uyu munsi. Ohereza risiti nyuma yo kwishyura.',
    rentDueReminder: 'Kwibutsa ubukode',
    rentDueReminderMessage: 'Ubukode buzishyurwa ku wa {date}.',
    currentPeriod: 'Ukwezi kurebwa',
    pendingConfirmation: '{amount} iri gutegereza kwemezwa na admin.',
    dueAmount: 'Amafaranga asigaye',
    dueDate: 'Itariki yo kwishyura',
    uploadReceipt: 'Ohereza risiti',
    monthlyRent: 'Ubukode bw ukwezi',
    paidAmount: 'Ayishyuwe',
    outstandingBalance: 'Asigaye',
    paymentHistory: 'Amateka y ubwishyu',
    paymentHistorySubtitle: 'Risiti n ubwishyu bwa konti yawe y umupangayi.',
    totalPaid: 'Yose yishyuwe',
    lastPaymentDate: 'Ubwishyu bwa nyuma',
    pendingPayments: 'Ibitegereje',
    backToDashboard: 'Subira',
    uploadNewReceipt: 'Risiti nshya',
    downloadStatement: 'Kuramo raporo',
    contactAdmin: 'Vugana na admin',
    paymentsTitle: 'Ubwishyu',
    homePriority: 'Urugo rwawe, inshingano zacu',
    welcomeBack: 'Murakaza neza, {name}!',
    tenancySummary: 'Dore ibireba ubukode bwawe.',
    notifications: 'Amamenyesha',
    rentDueInDays: 'Ubukode buzishyurwa mu minsi {days}.',
    rentDueTodayBanner: 'Ubukode bugomba kwishyurwa uyu munsi.',
    rentOverdueBanner: 'Ubukode bwararenze.',
    avoidLateFees: 'Nyamuneka wishyure wirinde ibihano byo gukererwa.',
    payRentNow: 'Ishyura ubu',
    currentBalance: 'Asigaye',
    nextPaymentAmount: 'Amafaranga y ubwishyu butaha',
    nextPaymentDue: 'Itariki ikurikira',
    nextPaymentMessage: 'Ubwishyu bw ubukode butaha buzaba ku wa {date}.',
    daysRemaining: 'Hasigaye iminsi {days}',
    property: 'Inyubako',
    viewDetails: 'Reba ibisobanuro',
    makePayment: 'Kora ubwishyu',
    viewMyLease: 'Reba amasezerano',
    quickActions: 'Ibikorwa byihuse',
    payRent: 'Ishyura ubukode',
    securePayment: 'Kwishyura mu mutekano',
    viewPayments: 'Reba ubwishyu bwawe',
    maintenanceRequest: 'Gusaba gusanirwa',
    reportIssue: 'Menyesha ikibazo',
    documentsReceipts: 'Inyandiko na risiti',
    viewDownload: 'Reba kandi ukuremo',
    sendViewMessages: 'Ohereza cyangwa urebe ubutumwa',
    profileInfo: 'Amakuru yanjye',
    announcementsTitle: 'Amatangazo',
    upcomingPayment: 'Ubwishyu butaha',
    recentPayments: 'Ubwishyu bwa vuba',
    viewAll: 'Reba byose',
    viewAllPayments: 'Reba ubwishyu bwose',
    needHelp: 'Ukeneye ubufasha?',
    hereForYou: 'Turi hano kubafasha',
    secureProtected: 'Amakuru yawe ararinzwe.',
    noAnnouncements: 'Nta tangazo rirahari.',
    noRecentPayments: 'Nta bwishyu bwa vuba.',
    paid: 'Byemejwe',
    rentForPeriod: 'Ubukode bwa {period}',
    houseNo: 'Inzu No. {unit}',
    cityCountry: 'Kigali, Rwanda',
    uploadPaymentReceipt: 'Ohereza risiti',
    uploadPaymentSubtitle: 'Risiti za banki zo kwemeza ubwishyu bwa UBUMWE HOUSE LTD.',
    receiptDetails: 'Amakuru ya risiti',
    loadingAccountDetails: 'Turimo gufungura konti...',
    amount: 'Amafaranga',
    paymentDate: 'Itariki y ubwishyu',
    paymentPeriod: 'Ukwezi kwishyurwa',
    method: 'Uburyo',
    bankDeposit: 'Kwishyura banki',
    mobileMoney: 'Mobile Money',
    cash: 'Cash',
    check: 'Sheki',
    receiptFile: 'Ifoto cyangwa PDF ya risiti',
    notes: 'Ibisobanuro',
    uploading: 'Birimo koherezwa...',
    submitProof: 'Ohereza icyemezo',
    updateProof: 'Hindura icyemezo',
    editingReceiptNotice: 'Urimo guhindura risiti yanze/itegereje. Izongera yoherezwe kwemezwa.',
    keepCurrentReceipt: 'Siga ahatuzuye niba ushaka kugumana risiti iriho.',
    contactManagement: 'Vugana n ubuyobozi',
    helpSupport: 'Ubufasha',
    settings: 'Igenamiterere',
    privacySecurity: 'Umutekano',
    receipts: 'Risiti',
    tenantLabel: 'Umupangayi',
    unit: 'Inzu',
    uploadReceiptRequired: 'Banza ushyiremo ifoto cyangwa PDF ya risiti.',
    paymentProofUploaded: 'Icyemezo cy ubwishyu cyoherejwe neza.',
    failedLoadTenantAccount: 'Ntibyashobotse gufungura konti y umupangayi.',
    failedUploadPaymentProof: 'Ntibyashobotse kohereza icyemezo cy ubwishyu.',
    rentMonth: 'Ukwezi',
    amountPaid: 'Ayishyuwe',
    paymentMethod: 'Uburyo bwo kwishyura',
    transactionReference: 'Nomero y ubwishyu',
    paymentStatus: 'Imiterere',
    receipt: 'Risiti',
    rejectionReason: 'Impamvu yanze',
    loadingPaymentHistory: 'Turimo gufungura amateka...',
    reason: 'Impamvu',
    noRejectionReason: 'Nta mpamvu yanditswe. Vugana na admin.',
    rejectedOn: 'Yanzwe {date}',
    viewDownloadReceipt: 'Reba / Kuramo',
    noPaymentHistoryYet: 'Nta mateka y ubwishyu.',
    failedLoadPaymentHistory: 'Ntibyashobotse gufungura amateka y ubwishyu.',
    approved: 'Byemejwe',
    pending: 'Bitegereje',
    rejected: 'Byanzwe',
    partial: 'Igice',
    overpaid: 'Yarenze',
    maintenanceTitle: 'Gusaba gusanirwa',
    maintenanceSubtitle: 'Ubufasha bwa UBUMWE HOUSE LTD mu gusana no gukurikirana.',
    updateRequest: 'Hindura icyifuzo',
    createRequest: 'Saba gusanirwa',
    cancelEdit: 'Reka guhindura',
    title: 'Umutwe',
    category: 'Icyiciro',
    priority: 'Ubwihutirwe',
    description: 'Ibisobanuro',
    general: 'Rusange',
    plumbing: 'Amazi',
    electrical: 'Amashanyarazi',
    cleaning: 'Isuku',
    security: 'Umutekano',
    appliance: 'Igikoresho',
    normal: 'Bisanzwe',
    low: 'Bucye',
    urgent: 'Byihutirwa',
    maintenanceTitlePlaceholder: 'Urugero: Amazi arava mu bwiherero',
    maintenanceDescriptionPlaceholder: 'Sobanura ikibazo, aho kiri, n igihe kibaho.',
    submitRequest: 'Ohereza icyifuzo',
    submitting: 'Birimo koherezwa...',
    updating: 'Birimo guhindurwa...',
    requestHistory: 'Amateka y ibisabwe',
    loadingRequests: 'Turimo gufungura ibisabwe...',
    noMaintenanceRequests: 'Nta cyifuzo cyo gusanirwa.',
    edit: 'Hindura',
    delete: 'Siba',
    deleting: 'Birimo gusibwa...',
    deleteOpenRequestConfirm: 'Ushaka gusiba iki cyifuzo gifunguye?',
    addTitleDescription: 'Shyiramo umutwe n ibisobanuro mbere yo kohereza.',
    maintenanceUpdated: 'Icyifuzo cyo gusanirwa cyahinduwe.',
    maintenanceSubmitted: 'Icyifuzo cyo gusanirwa cyoherejwe.',
    maintenanceDeleted: 'Icyifuzo cyo gusanirwa cyasibwe.',
    failedLoadMaintenance: 'Ntibyashobotse gufungura ibisabwa byo gusana.',
    failedUpdateMaintenance: 'Ntibyashobotse guhindura icyifuzo.',
    failedSubmitMaintenance: 'Ntibyashobotse kohereza icyifuzo.',
    failedDeleteMaintenance: 'Ntibyashobotse gusiba icyifuzo.',
    messagesTitle: 'Ubutumwa',
    messagesSubtitle: 'Vugana n abakozi ba UBUMWE HOUSE LTD.',
    roomOffice: 'Icyumba / Ofisi',
    status: 'Imiterere',
    inboxState: 'Uko ubutumwa buhagaze',
    unread: 'Butarasomwa',
    empty: 'Nta kirimo',
    supportChat: 'Ubutumwa bw ubufasha',
    loadingMessages: 'Turimo gufungura ubutumwa...',
    noMessagesYet: 'Nta butumwa. Tangira ikiganiro.',
    you: 'Wowe',
    admin: 'Admin',
    messagePlaceholder: 'Andika ubutumwa...',
    sending: 'Birimo koherezwa...',
    sendMessage: 'Ohereza ubutumwa',
    failedLoadPortalDetails: 'Ntibyashobotse gufungura amakuru ya portal.',
    failedLoadMessages: 'Ntibyashobotse gufungura ubutumwa.',
    failedSendMessage: 'Ntibyashobotse kohereza ubutumwa.',
    latestUpdates: 'Amakuru mashya',
    announcementsSubtitle: 'Amatangazo ya UBUMWE HOUSE LTD ku bapangayi.',
    loadingAnnouncements: 'Turimo gufungura amatangazo...',
    noAnnouncementsLong: 'Nta tangazo. Amatangazo mashya azagaragara hano.',
    expires: 'Rizarangira',
    failedLoadAnnouncements: 'Ntibyashobotse gufungura amatangazo.',
    profileSubtitle: 'Amakuru ya konti y umupangayi ahujwe na UBUMWE HOUSE LTD.',
    tenantDetails: 'Amakuru y umupangayi',
    loadingProfile: 'Turimo gufungura umwirondoro...',
    tenantName: 'Amazina y umupangayi',
    company: 'Ikigo',
    email: 'Email',
    phone: 'Telefone',
    building: 'Inyubako',
    failedLoadProfile: 'Ntibyashobotse gufungura umwirondoro.',
    logout: 'Sohoka'
  }
};

const getStoredLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return languages.some((language) => language.code === stored) ? stored : 'en';
  } catch (_) {
    return 'en';
  }
};

const setStoredLanguage = (languageCode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    window.dispatchEvent(new CustomEvent('tp:language-changed', { detail: { language: languageCode } }));
  } catch (_) {}
};

const useTenantLanguage = () => {
  const [language, setLanguage] = React.useState(getStoredLanguage);

  React.useEffect(() => {
    const handleChange = (event) => {
      setLanguage(event.detail?.language || getStoredLanguage());
    };
    window.addEventListener('tp:language-changed', handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener('tp:language-changed', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  return [language, navTranslations[language] || navTranslations.en];
};

const formatTenantText = (template = '', values = {}) => (
  String(template).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? '')
);

const TenantLanguageSelect = ({ compact = false }) => {
  const [language, copy] = useTenantLanguage();

  const handleChange = (event) => {
    setStoredLanguage(event.target.value);
  };

  return (
    <label className={`tp-language-select${compact ? ' compact' : ''}`}>
      <span>{copy.language}</span>
      <select value={language} onChange={handleChange} aria-label="Tenant portal language">
        {languages.map((item) => (
          <option key={item.code} value={item.code}>{item.label}</option>
        ))}
      </select>
    </label>
  );
};

const getRealtimeCopy = (payload = {}) => {
  if (payload.sender_type === 'admin') {
    return {
      title: 'UBUMWE HOUSE LTD',
      message: payload.message || 'You have a new message from support.'
    };
  }
  if (payload.event_type === 'tenant_payment_update') {
    return {
      title: payload.title || 'Payment update',
      message: payload.message || 'Your payment status was updated.'
    };
  }
  if (payload.event_type === 'tenant_announcement') {
    return {
      title: payload.title || 'New announcement',
      message: payload.message || 'A new announcement is available.'
    };
  }
  if (payload.event_type === 'tenant_maintenance_update') {
    return {
      title: payload.title || 'Maintenance update',
      message: payload.message || 'Your maintenance request was updated.'
    };
  }
  if (payload.event_type === 'tenant_rent_due') {
    return {
      title: payload.title || 'Rent payment reminder',
      message: payload.message || 'Your rent payment is due soon.'
    };
  }
  return null;
};

const TenantPortalRealtimeBridge = () => {
  const navigate = useNavigate();
  const [popup, setPopup] = React.useState(null);
  const dismissTimerRef = React.useRef(null);

  const dismissPopup = React.useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setPopup(null);
  }, []);

  const showPopup = React.useCallback((nextPopup) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setPopup(nextPopup);
    dismissTimerRef.current = setTimeout(() => {
      setPopup(null);
      dismissTimerRef.current = null;
    }, 9000);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      registerTenantPushSubscription(tenantPortalService);
    }
  }, []);

  React.useEffect(() => {
    const streamUrl = tenantPortalService.getStreamUrl();
    if (!streamUrl) return undefined;

    const source = new EventSource(streamUrl);
    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const eventId = payload?.id || `${payload?.event_type || payload?.sender_type || 'event'}-${payload?.created_at || Date.now()}`;
        if (seenRealtimeIds.has(eventId)) return;
        seenRealtimeIds.add(eventId);
        if (seenRealtimeIds.size > 200) seenRealtimeIds.clear();

        window.dispatchEvent(new CustomEvent('tp:portal-event', { detail: payload }));

        const copy = getRealtimeCopy(payload);
        if (!copy) return;

        if (payload.sender_type === 'admin') {
          incrementUnread();
        }

        emitAppToast(copy.message, 'realtime');
        showPopup({
          id: eventId,
          title: copy.title,
          message: copy.message,
          path: payload.actionPath || (payload.sender_type === 'admin' ? '/tenant-portal/messages' : '/tenant-portal')
        });
        showBrowserNotification(copy.title, copy.message, {
          tag: eventId,
          data: { url: payload.actionPath || '/tenant-portal' }
        });
      } catch (_) {}
    };

    source.addEventListener('message', onMessage);
    source.onerror = () => {};

    return () => {
      source.removeEventListener('message', onMessage);
      source.close();
    };
  }, [showPopup]);

  React.useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  if (!popup || typeof document === 'undefined') return null;

  return createPortal(
    <div className="tp-realtime-popup" role="status" aria-live="polite">
      <div className="tp-realtime-popup-glow" aria-hidden="true" />
      <div className="tp-realtime-popup-copy">
        <span>Live update</span>
        <strong>{popup.title}</strong>
        <p>{popup.message}</p>
      </div>
      <div className="tp-realtime-popup-actions">
        <button
          type="button"
          className="tp-realtime-popup-open"
          onClick={() => {
            const targetPath = popup.path || '/tenant-portal';
            dismissPopup();
            navigate(targetPath);
          }}
        >
          Open
        </button>
        <button type="button" className="tp-realtime-popup-close" onClick={dismissPopup} aria-label="Dismiss notification">
          x
        </button>
      </div>
    </div>,
    document.body
  );
};

export const TenantNotificationPermissionButton = ({ inline = false, floating = false }) => {
  const [, copy] = useTenantLanguage();
  const [permission, setPermission] = React.useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const syncPermission = () => {
      if (!('Notification' in window)) {
        setPermission('unsupported');
        return;
      }
      setPermission(Notification.permission);
    };
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  if (permission === 'unsupported') return null;

  const enabled = permission === 'granted';

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nextPermission = enabled ? 'granted' : await requestNotificationPermission();
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        await registerTenantPushSubscription(tenantPortalService);
        emitAppToast(enabled ? 'Phone alerts are working' : 'Phone notifications enabled', 'success');
        await showBrowserNotification(
          'UBUMWE HOUSE LTD',
          enabled ? 'Alerts are active on this phone.' : 'Phone notifications are now enabled.',
          {
            tag: 'tenant-alerts-test',
            data: { url: '/tenant-portal' }
          }
        );
      } else if (nextPermission === 'denied') {
        emitAppToast('Notifications are blocked in phone settings', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={[
        'tp-phone-notification-button',
        inline ? 'inline' : '',
        floating ? 'floating' : ''
      ].filter(Boolean).join(' ')}
      onClick={handleEnable}
      disabled={busy}
      aria-label={enabled ? 'Test phone notifications' : 'Enable phone notifications'}
      title={enabled ? 'Test phone notifications' : 'Enable phone notifications'}
    >
      <span className="tp-phone-notification-icon"><BellGlyph /></span>
      <span>{busy ? copy.enabling : enabled ? copy.alertsOn : copy.enableAlerts}</span>
    </button>
  );
};

const getCurrentFromPath = (pathname = '') => {
  const exactMatch = navItems.find((item) => item.path === pathname);
  if (exactMatch) return exactMatch.id;

  const nestedMatch = navItems
    .filter((item) => item.path !== '/tenant-portal' && pathname.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (nestedMatch) return nestedMatch.id;
  if (pathname.startsWith('/tenant-portal')) return 'dashboard';
  return '';
};

const splitTenantPath = (path = '') => {
  const [pathname, hash = ''] = String(path || '').split('#');
  return { pathname, hash };
};

const getCurrentTenantItem = (pathname = '', hash = '') => {
  if (hash) {
    const hashMatch = navItems.find((item) => {
      const target = splitTenantPath(item.path);
      return target.pathname === pathname && target.hash === hash.replace(/^#/, '');
    });
    if (hashMatch) return hashMatch.id;
  }

  return getCurrentFromPath(pathname);
};

const scrollTenantHash = (hash = '') => {
  if (typeof document === 'undefined' || !hash) return;
  const target = document.getElementById(hash);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const TENANT_PORTAL_BRAND_NAME = 'UBUMWE HOUSE SYSTEM';
const TENANT_PORTAL_EMAIL = 'ubumwehouseltd@gmail.com';

const TenantMobileAppHeader = ({
  current = '',
  notificationCount = 0,
  brandName = TENANT_PORTAL_BRAND_NAME,
  contactEmail = TENANT_PORTAL_EMAIL,
  onDashboardClick,
  onLogout
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadMessages = useTenantUnread();
  const [, copy] = useTenantLanguage();
  const [open, setOpen] = React.useState(false);
  const activeItem = location.hash ? getCurrentTenantItem(location.pathname, location.hash) : current || getCurrentFromPath(location.pathname);

  const goTo = (path) => {
    setOpen(false);
    const target = splitTenantPath(path);
    if (target.pathname === '/tenant-portal' && onDashboardClick && !target.hash) {
      onDashboardClick();
      return;
    }
    navigate(path);
    window.setTimeout(() => scrollTenantHash(target.hash), 80);
  };

  const handleLogout = () => {
    setOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    tenantPortalService.clearToken();
    navigate('/tenant-portal');
  };

  return (
    <>
      <header className="tp-mobile-app-header" aria-label="Tenant portal app header">
        <button type="button" aria-label="Open tenant menu" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span />
          <span />
          <span />
        </button>
        <div className="tp-mobile-brand">
          <div className="tp-house-logo" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <strong>{brandName}</strong>
          <small>{copy.homePriority}</small>
        </div>
        <div className="tp-mobile-header-actions">
          <button type="button" aria-label={copy.notifications} onClick={() => navigate('/tenant-portal/announcements')}>
            {icons.announcements}
            {notificationCount > 0 ? <strong>{notificationCount > 99 ? '99+' : notificationCount}</strong> : null}
          </button>
          <button type="button" aria-label={copy.messages} onClick={() => navigate('/tenant-portal/messages')}>
            {icons.messages}
            {unreadMessages > 0 ? <strong>{unreadMessages > 99 ? '99+' : unreadMessages}</strong> : null}
          </button>
        </div>
      </header>

      {open ? (
        <div className="tp-mobile-drawer-shell" role="presentation">
          <button className="tp-mobile-drawer-backdrop" type="button" aria-label="Close tenant menu" onClick={() => setOpen(false)} />
          <aside className="tp-mobile-menu-panel" aria-label="Tenant app sidebar">
            <button className="tp-mobile-menu-close" type="button" aria-label="Close tenant menu" onClick={() => setOpen(false)}>x</button>
            <div className="tp-mobile-menu-brand">
              <div className="tp-house-logo" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <strong>{brandName}</strong>
              <small>{copy.homePriority}</small>
            </div>

            <div className="tp-mobile-menu-controls">
              <TenantLanguageSelect />
              <TenantNotificationPermissionButton inline />
            </div>

            <div className="tp-mobile-menu-list">
              <button className={activeItem === 'dashboard' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal')}>
                {icons.dashboard}
                <b>{copy.dashboard}</b>
              </button>
              <button className={activeItem === 'upload' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/upload#receipt')}>
                {icons.payments}
                <b>{copy.payRent}</b>
              </button>
              <button className={activeItem === 'payments' || activeItem === 'history' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/payments#history')}>
                {icons.history}
                <b>{copy.paymentHistory}</b>
              </button>
              <button className={activeItem === 'documents' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/payments#receipts')}>
                {icons.documents}
                <b>{copy.receipts}</b>
              </button>
              <button className={activeItem === 'announcements' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/announcements#notices')}>
                {icons.announcements}
                <b>{copy.notifications}</b>
                {notificationCount > 0 ? <em>{notificationCount > 99 ? '99+' : notificationCount}</em> : null}
              </button>
              <button className={activeItem === 'messages' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/messages')}>
                {icons.messages}
                <b>{copy.messages}</b>
                {unreadMessages > 0 ? <em>{unreadMessages > 99 ? '99+' : unreadMessages}</em> : null}
              </button>
              <button className={activeItem === 'maintenance' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/maintenance')}>
                {icons.maintenance}
                <b>{copy.maintenanceTitle}</b>
              </button>
              <button className={activeItem === 'lease' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/profile#lease')}>
                {icons.lease}
                <b>{copy.lease}</b>
              </button>
              <button className={activeItem === 'documents' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/payments#receipts')}>
                {icons.documents}
                <b>{copy.documents}</b>
              </button>
              <button className={activeItem === 'profile' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/profile')}>
                {icons.profile}
                <b>{copy.profile}</b>
              </button>
              <hr />
              <a href={`mailto:${contactEmail}`}>
                {icons.support}
                <b>{copy.contactManagement}</b>
              </a>
              <button className={activeItem === 'support' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/messages#support')}>
                {icons.support}
                <b>{copy.helpSupport}</b>
              </button>
              <button className={activeItem === 'password' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/profile#password')}>
                {icons.password}
                <b>{copy.settings}</b>
              </button>
              <button className={activeItem === 'password' ? 'active' : ''} type="button" onClick={() => goTo('/tenant-portal/profile#password')}>
                {icons.password}
                <b>{copy.privacySecurity}</b>
              </button>
              <hr />
              <button className="logout" type="button" onClick={handleLogout}>
                {icons.password}
                <b>{copy.logout}</b>
              </button>
            </div>
            <div className="tp-mobile-menu-secure">
              {icons.password}
              <p>{copy.secureProtected}</p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
};

const TenantPortalNav = ({ current = '', mobileOnly = false, onDashboardClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadMessages = useTenantUnread();
  const [, copy] = useTenantLanguage();
  const activeItem = location.hash ? getCurrentTenantItem(location.pathname, location.hash) : current || getCurrentFromPath(location.pathname);

  const handleClick = (item) => {
    const target = splitTenantPath(item.path);
    if (item.id === 'messages') {
      clearUnread();
    }

    if (item.id === 'dashboard' && onDashboardClick && !target.hash) {
      onDashboardClick();
      return;
    }

    if (location.pathname === target.pathname) {
      if (target.hash) {
        navigate(item.path, { replace: location.hash === `#${target.hash}` });
        scrollTenantHash(target.hash);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    navigate(item.path);
    window.setTimeout(() => scrollTenantHash(target.hash), 80);
  };

  return (
    <>
      <TenantPortalRealtimeBridge />
      <nav className={`tp-nav${mobileOnly ? ' tp-mobile-nav' : ''}`} aria-label="Tenant portal navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              activeItem === item.id ? 'active' : '',
              item.id === 'messages' ? 'tp-nav-msg-btn' : '',
              item.extra ? 'tp-nav-extra' : ''
            ].filter(Boolean).join(' ')}
            onClick={() => handleClick(item)}
            aria-label={item.label}
            aria-current={activeItem === item.id ? 'page' : undefined}
            title={item.label}
          >
            {icons[item.id]}
            <span className="tp-nav-label">{copy[item.id] || item.shortLabel || item.label}</span>
            {item.id === 'messages' && unreadMessages > 0 ? (
              <span className="tp-nav-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </>
  );
};

export default TenantPortalNav;
const TenantPortalShell = ({ current = '', children, onDashboardClick }) => {
  const navigate = useNavigate();
  const [, copy] = useTenantLanguage();

  return (
    <main className="tp-page">
      <div className="tp-dashboard tp-subpage-dashboard">
        <aside className="tp-sidebar">
          <div className="tp-brand-block">
            <div className="tp-house-logo" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="tp-brand-title">{TENANT_PORTAL_BRAND_NAME}</div>
            <div className="tp-brand-subtitle">{copy.homePriority}</div>
          </div>

          <TenantPortalNav current={current} onDashboardClick={onDashboardClick} />

          <div className="tp-help-card">
            <span>{icons.support}</span>
            <strong>{copy.needHelp}</strong>
            <p>{copy.hereForYou}</p>
            <a href={`mailto:${TENANT_PORTAL_EMAIL}`}>{TENANT_PORTAL_EMAIL}</a>
          </div>

          <div className="tp-sidebar-actions">
            <TenantLanguageSelect />
            <TenantNotificationPermissionButton inline />
            <button
              className="tp-logout"
              type="button"
              onClick={() => {
                tenantPortalService.clearToken();
                navigate('/tenant-portal');
              }}
            >
              {copy.logout}
            </button>
          </div>
        </aside>

        <section className="tp-main tp-subpage-main">
          {children}
        </section>
      </div>
      <TenantPortalNav current={current} mobileOnly />
    </main>
  );
};

export { formatTenantText, TenantLanguageSelect, TenantMobileAppHeader, TenantPortalShell, useTenantLanguage };
