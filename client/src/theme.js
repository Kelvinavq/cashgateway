import { createTheme } from '@mui/material/styles';

export function createAppTheme(mode) {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary:   { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrastText: '#fff' },
      secondary: { main: '#06b6d4', contrastText: '#fff' },
      success:   { main: '#10b981', light: '#34d399', contrastText: '#fff' },
      error:     { main: '#ef4444', light: '#f87171', contrastText: '#fff' },
      warning:   { main: '#f59e0b', light: '#fbbf24', contrastText: '#fff' },
      info:      { main: '#3b82f6', light: '#60a5fa', contrastText: '#fff' },
      background: {
        default: dark ? '#0b1120' : '#f1f5f9',
        paper:   dark ? '#131c2e' : '#ffffff',
      },
      divider: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)',
      text: {
        primary:   dark ? '#e2e8f0' : '#0f172a',
        secondary: dark ? '#64748b'  : '#64748b',
      },
      action: {
        hover:    dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
        selected: dark ? 'rgba(99,102,241,0.15)'  : 'rgba(99,102,241,0.08)',
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", "Roboto", -apple-system, sans-serif',
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body2: { lineHeight: 1.6 },
      caption: { lineHeight: 1.4 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { boxSizing: 'border-box' },
          body: { scrollbarWidth: 'thin' },
          '::-webkit-scrollbar': { width: 4, height: 4 },
          '::-webkit-scrollbar-thumb': {
            background: dark ? '#1e293b' : '#cbd5e1',
            borderRadius: 4,
          },
          '::-webkit-scrollbar-track': { background: 'transparent' },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 12,
          }),
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 16, '&:last-child': { paddingBottom: 16 } },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0, borderRadius: 8 },
          sizeSmall: { fontSize: '0.8125rem', padding: '4px 12px' },
          sizeMedium: { padding: '7px 16px' },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 8, transition: 'background 0.15s' },
          sizeSmall: { padding: 5 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.688rem', borderRadius: 6, height: 22, letterSpacing: 0 },
          label: { paddingLeft: 8, paddingRight: 8 },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableCell-head': {
              backgroundColor: dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
              fontWeight: 600,
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: theme.palette.text.secondary,
              borderBottom: `1px solid ${theme.palette.divider}`,
              whiteSpace: 'nowrap',
              paddingTop: 10,
              paddingBottom: 10,
            },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
            padding: '9px 12px',
            fontSize: '0.8125rem',
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:last-child td': { borderBottom: 0 },
            '&.MuiTableRow-hover:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }),
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: '0.875rem' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundImage: 'none', borderRadius: 14 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: '0.72rem', borderRadius: 6 },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
    },
  });
}
