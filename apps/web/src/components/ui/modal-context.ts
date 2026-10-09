'use client';

import { createContext, useContext } from 'react';

/** True inside a modal — form controls there use their Material UI versions. */
export const InModalContext = createContext(false);
export const useInModal = () => useContext(InModalContext);
