import React from 'react';
import '../styles/copilot-spinner.css';
import sammIco from '../assets/samm.ico';

const CopilotSpinner = ({ size = 64 }) => (
  <div className="copilot-spinner-overlay">
    <div className="copilot-spinner" style={{ width: size, height: size }}>
      <img src={sammIco} alt="Loading" className="copilot-spinner-img" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  </div>
);

export default CopilotSpinner;
