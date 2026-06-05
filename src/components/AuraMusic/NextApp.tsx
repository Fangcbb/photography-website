import React from "react";
import App from "./App";
import { I18nProvider } from "./hooks/useI18n";

// Simple toast provider for Next.js
const SimpleToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const NextApp: React.FC = () => {
  return (
    <I18nProvider>
      <SimpleToastProvider>
        <App />
      </SimpleToastProvider>
    </I18nProvider>
  );
};

export default NextApp;
