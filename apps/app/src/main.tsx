import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@study-tracker/design-tokens/global.css';
import '@study-tracker/design-tokens/tokens.css';
import '@study-tracker/design-tokens/components.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);