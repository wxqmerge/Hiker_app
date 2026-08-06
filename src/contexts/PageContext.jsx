import { createContext, useContext, useState } from 'react';

const PageContext = createContext({ pageContext: '', setPageContext: () => {} });

export function PageContextProvider({ children }) {
  const [pageContext, setPageContext] = useState('');
  return (
    <PageContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  return useContext(PageContext);
}
