// @ts-strict-ignore
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { useGlobalPref } from '#hooks/useGlobalPref';

type SidebarContextValue = {
  hidden: boolean;
  setHidden: Dispatch<SetStateAction<boolean>>;
  floating: boolean;
};

const SidebarContext = createContext<SidebarContextValue>(null);

type SidebarProviderProps = {
  children: ReactNode;
};

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [floatingSidebar] = useGlobalPref('floatingSidebar');
  const [hidden, setHidden] = useState(true);

  return (
    <SidebarContext.Provider
      value={{ hidden, setHidden, floating: floatingSidebar }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const { hidden, setHidden, floating } = useContext(SidebarContext);

  return useMemo(
    () => ({ hidden, setHidden, floating }),
    [hidden, setHidden, floating],
  );
}
