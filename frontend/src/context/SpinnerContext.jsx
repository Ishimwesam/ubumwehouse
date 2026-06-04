import React, { createContext, useContext, useState, useCallback } from 'react';
import CopilotSpinner from '../components/CopilotSpinner';

const SpinnerContext = createContext({ show: false, setShow: () => {} });

export const useSpinner = () => useContext(SpinnerContext);

export const SpinnerProvider = ({ children }) => {
  const [show, setShow] = useState(false);
  const showSpinner = useCallback(() => setShow(true), []);
  const hideSpinner = useCallback(() => setShow(false), []);

  return (
    <SpinnerContext.Provider value={{ show, setShow, showSpinner, hideSpinner }}>
      {show && <CopilotSpinner size={72} />}
      {children}
    </SpinnerContext.Provider>
  );
};
