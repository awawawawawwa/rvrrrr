import {createContext} from 'react';

export type AppContextValue = {
	exit: (error?: Error) => void;
};

// No default value — throw if consumed outside a provider
export const AppContext = createContext<AppContextValue>(
	undefined as unknown as AppContextValue,
);

AppContext.displayName = 'AppContext';
