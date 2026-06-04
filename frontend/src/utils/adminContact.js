const ADMIN_EMAIL = 'ishimwesamuel023@gmail.com';

const ACCESS_REQUEST_SUBJECT = 'Request for system access';
const ACCESS_REQUEST_BODY_LINES = [
  'Hello Administrator,',
  '',
  'I would like to request access to the Ubumwe System Company platform.',
  '',
  'Name:',
  'Phone:',
  'Reason for access:'
];

const buildMailtoLink = ({ subject, bodyLines }) => {
  const body = bodyLines.join('\n');
  return `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const buildGmailComposeLink = ({ subject, bodyLines }) => {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: ADMIN_EMAIL,
    su: subject,
    body: bodyLines.join('\n')
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const adminContactLinks = {
  accessRequest: buildGmailComposeLink({
    subject: ACCESS_REQUEST_SUBJECT,
    bodyLines: ACCESS_REQUEST_BODY_LINES
  }),
  accessRequestMailto: buildMailtoLink({
    subject: ACCESS_REQUEST_SUBJECT,
    bodyLines: ACCESS_REQUEST_BODY_LINES
  }),
  passwordRecovery: buildMailtoLink({
    subject: 'Help with password recovery',
    bodyLines: [
      'Hello Administrator,',
      '',
      'I need help recovering my account.',
      '',
      'Email:',
      'Problem details:'
    ]
  })
};

export const adminContactEmail = ADMIN_EMAIL;
