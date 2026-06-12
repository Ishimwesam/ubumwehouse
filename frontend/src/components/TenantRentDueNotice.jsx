import React from 'react';
import { formatTenantText, useTenantLanguage } from './TenantPortalNav';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getDueCopy = (rentDue = {}, text) => {
  if (rentDue.is_next_payment) {
    return {
      tone: 'upcoming',
      title: text.nextPaymentDue || 'Next Payment Due',
      message: formatTenantText(text.nextPaymentMessage || 'Your next rent payment is due on {date}.', { date: formatDate(rentDue.due_date) })
    };
  }

  if (rentDue.status === 'paid') {
    return {
      tone: 'paid',
      title: text.rentPaid,
      message: formatTenantText(text.rentPaidMessage, { period: rentDue.period || text.currentPeriod })
    };
  }

  if (rentDue.status === 'overdue') {
    return {
      tone: 'overdue',
      title: text.rentOverdue,
      message: formatTenantText(text.rentOverdueMessage, { date: formatDate(rentDue.due_date) })
    };
  }

  if (rentDue.status === 'due_today') {
    return {
      tone: 'due_today',
      title: text.rentDueToday,
      message: text.rentDueTodayMessage
    };
  }

  return {
    tone: 'upcoming',
    title: text.rentDueReminder,
    message: formatTenantText(text.rentDueReminderMessage, { date: formatDate(rentDue.due_date) })
  };
};

const TenantRentDueNotice = ({ tenant, checkedAt, onUpload }) => {
  const [, text] = useTenantLanguage();
  const rentDue = tenant?.rent_due;
  if (!rentDue) return null;

  const copy = getDueCopy(rentDue, text);
  const remaining = Number(rentDue.remaining_amount || 0);
  const pending = Number(rentDue.pending_amount || 0);
  const paid = Number(rentDue.paid_amount || tenant?.current_period_paid || 0);
  const monthlyRent = Number(rentDue.monthly_rent || tenant?.monthly_rent || 0);
  const syncedAt = formatDateTime(checkedAt);
  const isNextPayment = Boolean(rentDue.is_next_payment);

  return (
    <section className={`tp-rent-due-notice ${copy.tone}`} aria-live="polite">
      <div className="tp-rent-due-copy">
        <span>{rentDue.period || text.currentPeriod}</span>
        <h2>{copy.title}</h2>
        <p>{copy.message}</p>
        <small className="tp-rent-live-source">
          Live from admin account{syncedAt ? ` - synced ${syncedAt}` : ''}
        </small>
        {pending > 0 ? <small>{formatTenantText(text.pendingConfirmation, { amount: formatCurrency(pending) })}</small> : null}
      </div>
      <div className="tp-rent-due-amounts">
        <div>
          <span>{isNextPayment ? (text.nextPaymentAmount || 'Next Payment Amount') : text.dueAmount}</span>
          <strong>{formatCurrency(remaining)}</strong>
        </div>
        <div>
          <span>{text.paidAmount || 'Paid Amount'}</span>
          <strong>{formatCurrency(paid)}</strong>
        </div>
        <div>
          <span>{text.monthlyRent || 'Monthly Rent'}</span>
          <strong>{formatCurrency(monthlyRent)}</strong>
        </div>
        <div>
          <span>{text.dueDate}</span>
          <strong>{formatDate(rentDue.due_date)}</strong>
        </div>
      </div>
      {remaining > 0 && onUpload ? (
        <button type="button" className="tp-btn-primary" onClick={onUpload}>
          {text.uploadReceipt}
        </button>
      ) : null}
    </section>
  );
};

export default TenantRentDueNotice;
