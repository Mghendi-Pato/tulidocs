'use client';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import type {} from '@mui/x-date-pickers/themeAugmentation';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { ReactNode } from 'react';

/** Material UI is used only for date pickers; the theme matches the app's own tokens. */
const theme = createTheme({
  palette: {
    primary: { main: '#2451d6' },
    text: { primary: '#0f1b33', secondary: '#5b667a' },
    divider: '#e3e8f0',
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: "'Roboto Variable', ui-sans-serif, system-ui, sans-serif", fontSize: 14 },
  components: {
    MuiPickersOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 12,
          fontSize: 15,
          '& .MuiPickersOutlinedInput-notchedOutline': { borderColor: '#cfd6e2' },
          '&:hover .MuiPickersOutlinedInput-notchedOutline': { borderColor: '#cfd6e2' },
          '&.Mui-focused .MuiPickersOutlinedInput-notchedOutline': { borderColor: '#2451d6', borderWidth: 1 },
          '&.Mui-error .MuiPickersOutlinedInput-notchedOutline': { borderColor: '#b42318' },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          borderRadius: 12,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cfd6e2' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cfd6e2' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2451d6', borderWidth: 1 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#b42318' },
          '&.Mui-disabled': { backgroundColor: '#f3f6fb' },
        },
      },
    },
    MuiSelect: { styleOverrides: { select: { paddingLeft: 16, color: '#0f1b33' } } },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '0 6px',
          '&.Mui-selected': { backgroundColor: '#eef2fd' },
          '&.Mui-selected:hover': { backgroundColor: '#e3eafc' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { borderRadius: 16 } } },
  },
});

export function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui', enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
