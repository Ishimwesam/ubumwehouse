import React from 'react';

const PageLoader = ({ text = 'Loading...', minHeight = '60vh' }) => (
  <div style={{ ...styles.wrap, minHeight }} role="status" aria-live="polite">
    <div style={styles.spinner} aria-hidden="true" />
    {text ? <p style={styles.text}>{text}</p> : null}
  </div>
);

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    width: '100%',
    padding: '32px 16px'
  },
  spinner: {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: '4px solid #dbe6f5',
    borderTopColor: '#2563eb',
    animation: 'spin 0.9s linear infinite'
  },
  text: {
    margin: 0,
    color: '#51617f',
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'center',
    lineHeight: 1.45
  }
};

export default PageLoader;
