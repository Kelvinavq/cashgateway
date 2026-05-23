import { createTheme } from '@mui/material/styles';

export function createAppTheme(mode) {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary:   { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrastText: '#fff' },
      secondary: { main: '#8b5cf6', contrastText: '#fff' },
      success:   { main: '#10b981', light: '#34d399', contrastText: '#fff' },
      error:     { main: '#ef4444', light: '#f87171', contrastText: '#fff' },
      warning:   { main: '#f59e0b', light: '#fbbf24', contrastText: '#fff' },
      info:      { main: '#3b82f6', light: '#60a5fa', contrastText: '#fff' },
      background: {
        default: dark ? '#07101f' : '#f1f5f9',
        paper:   dark ? '#0d1628' : '#ffffff',
      },
      divider: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
      text: {
        primary:   dark ? '#e2e8f0' : '#0f172a',
        secondary: dark ? '#64748b'  : '#64748b',
        disabled:  dark ? '#334155' : '#94a3b8',
      },
      action: {
        hover:    dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
        selected: dark ? 'rgba(99,102,241,0.15)'  : 'rgba(99,102,241,0.08)',
      },
    },
    shape: { borderRadius: 12 },
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
          '::-webkit-scrollbar': { width: 5, height: 5 },
          '::-webkit-scrollbar-thumb': {
            background: dark ? 'rgba(99,102,241,0.3)' : '#cbd5e1',
            borderRadius: 6,
          },
          '::-webkit-scrollbar-track': { background: 'transparent' },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            background: dark
              ? 'linear-gradient(145deg, #0d1628 0%, #0f1b33 100%)'
              : '#ffffff',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
            borderRadius: 14,
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              borderColor: dark ? 'rgba(99,102,241,0.28)' : 'rgba(99,102,241,0.2)',
            },
          },
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
          root: {
            textTransform: 'none',
            fontWeight: 600,
            letterSpacing: 0,
            borderRadius: 9,
            transition: 'all 0.15s ease',
          },
          sizeSmall: { fontSize: '0.8125rem', padding: '4px 12px' },
          sizeMedium: { padding: '7px 18px' },
          containedPrimary: {
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 4px 22px rgba(99,102,241,0.45)',
            },
            '&.Mui-disabled': {
              background: dark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.3)',
              color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)',
            },
          },
          containedError: {
            '&:hover': { boxShadow: '0 4px 16px rgba(239,68,68,0.38)' },
          },
          outlinedPrimary: {
            borderColor: dark ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.5)',
            '&:hover': {
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99,102,241,0.08)',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'background 0.15s ease, color 0.15s ease',
          },
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
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: dark ? 'rgba(7,16,31,0.9)' : 'rgba(0,0,0,0.025)',
              fontWeight: 700,
              fontSize: '0.67rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: dark ? '#64748b' : '#94a3b8',
              borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'}`,
              whiteSpace: 'nowrap',
              paddingTop: 11,
              paddingBottom: 11,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.07)',
            padding: '9px 14px',
            fontSize: '0.8125rem',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child td': { borderBottom: 0 },
            '&.MuiTableRow-hover:hover': {
              backgroundColor: dark ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.03)',
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: '0.875rem' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.15)',
              transition: 'border-color 0.15s ease',
            },
            '&:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
              borderColor: dark ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.35)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#6366f1',
              borderWidth: 2,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            background: dark ? 'linear-gradient(145deg, #0d1628, #0f1b33)' : '#ffffff',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
            borderRadius: 16,
            boxShadow: dark
              ? '0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(99,102,241,0.08)'
              : '0 25px 60px rgba(0,0,0,0.12)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: '1rem', fontWeight: 700, paddingBottom: 8 },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize: '0.72rem',
            borderRadius: 7,
            background: dark ? 'rgba(10,18,34,0.97)' : 'rgba(15,23,42,0.92)',
            border: dark ? '1px solid rgba(255,255,255,0.09)' : 'none',
            backdropFilter: 'blur(10px)',
            padding: '5px 10px',
          },
          arrow: {
            color: dark ? 'rgba(10,18,34,0.97)' : 'rgba(15,23,42,0.92)',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 9 },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontSize: '0.8125rem',
            border: '1px solid transparent',
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'}`,
          },
          selectLabel: { fontSize: '0.8125rem' },
          displayedRows: { fontSize: '0.8125rem' },
        },
      },
    },
  });
}
