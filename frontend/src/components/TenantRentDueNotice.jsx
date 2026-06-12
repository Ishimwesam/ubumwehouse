import React from 'react';

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const getDueCopy = (rentDue = {}) => {
  if (rentDue.status === 'paid') {
    return {
      tone: 'paid',
      title: 'Rent paid',
      message: `Your rent for ${rentDue.period || 'this month'} is fully paid.`
    };
  }

  if (rentDue.status === 'overdue') {
    return {
      tone: 'overdue',
      title: 'Rent overdue',
      message: `Your rent was due on ${formatDate(rentDue.due_date)}. Please upload your payment receipt.`
    };
  }

  if (rentDue.status === 'due_today') {
    return {
      tone: 'due_today',
      title: 'Rent due today',
      message: 'Your rent is due today. Please upload your payment receipt after paying.'
    };
  }

  return {
    tone: 'upcoming',
    title: 'Rent due reminder',
    message: `Your rent is due on ${formatDate(rentDue.due_date)}.`
  };
};

const TenantRentDueNotice = ({ tenant, onUpload }) => {
  const rentDue = tenant?.rent_due;
  if (!rentDue) return null;

  const copy = getDueCopy(rentDue);
  const remaining = Number(rentDue.remaining_amount || 0);
  const pending = Number(rentDue.pending_amount || 0);

  return (
    <section className={`tp-rent-due-notice ${copy.tone}`} aria-live="polite">
      <div className="tp-rent-due-copy">
        <span>{rentDue.period || 'Current period'}</span>
        <h2>{copy.title}</h2>
        <p>{copy.message}</p>
        {pending > 0 ? <small>{formatCurrency(pending)} is waiting for admin confirmation.</small> : null}
      </div>
      <div className="tp-rent-due-amounts">
        <div>
          <span>Due amount</span>
          <strong>{formatCurrency(remaining)}</strong>
        </div>
        <div>
          <span>Due date</span>
          <strong>{formatDate(rentDue.due_date)}</strong>
        </div>
      </div>
      {remaining > 0 && onUpload ? (
        <button type="button" className="tp-btn-primary" onClick={onUpload}>
          Upload Receipt
        </button>
      ) : null}
    </section>
  );
};

export default TenantRentDueNotice;
