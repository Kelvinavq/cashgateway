import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Avatar, Tooltip, Divider, useTheme,
} from '@mui/material';
import {
  Dashboard, SwapHoriz, Webhook, AccountBalance, Language,
  Send, LightMode, DarkMode, Logout, Menu as MenuIcon,
  Dns, Article,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const DRAWER_WIDTH = 236;

const navItems = [
  { path: '/dashboard', label: 'Dashboard',   icon: Dashboard },
  { path: '/movements', label: 'Movimientos', icon: SwapHoriz },
  { path: '/deliveries',label: 'Entregas',    icon: Send },
  { path: '/accounts',  label: 'Cuentas HG', icon: AccountBalance },
  { path: '/domains',   label: 'Dominios',   icon: Language },
  { path: '/providers', label: 'Proveedores', icon: Dns },
  { path: '/logs',      label: 'Logs',        icon: Article },
];

function NavItem({ path, label, Icon, active, onClick }) {
  return (
    <ListItem disablePadding sx={{ mb: '3px' }}>
      <ListItemButton
        component={Link}
        to={path}
        onClick={onClick}
        selected={active}
        sx={{
          borderRadius: '9px',
          py: '9px',
          px: 1.5,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.18s ease',
          '&.Mui-selected': {
            background: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.12) 100%)',
            color: '#818cf8',
            borderLeft: '2.5px solid #6366f1',
            pl: 'calc(12px - 2.5px)',
            boxShadow: 'inset 0 0 24px rgba(99,102,241,0.07)',
            '& .MuiListItemIcon-root': { color: '#818cf8' },
            '&:hover': {
              background: 'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(139,92,246,0.16) 100%)',
            },
          },
          '&:not(.Mui-selected)': {
            color: 'rgba(148,163,184,0.85)',
            borderLeft: '2.5px solid transparent',
            pl: 'calc(12px - 2.5px)',
            '& .MuiListItemIcon-root': { color: 'rgba(148,163,184,0.6)' },
            '&:hover': {
              color: '#e2e8f0',
              bgcolor: 'rgba(255,255,255,0.05)',
              '& .MuiListItemIcon-root': { color: '#e2e8f0' },
            },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Icon sx={{ fontSize: 17 }} />
        </ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontSize: '0.8125rem',
            fontWeight: active ? 600 : 500,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggle } = useAppTheme();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dark = mode === 'dark';

  const handleLogout = async () => {
    await logout();
    toast.success('Sesión cerrada');
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  const sidebarBg = dark ? '#080e1d' : '#ffffff';
  const sidebarBorder = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: sidebarBg }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38, height: 38,
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 20px rgba(99,102,241,0.45), 0 4px 12px rgba(99,102,241,0.25)',
            }}
          >
            <Webhook sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '0.9rem',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                color: dark ? '#e2e8f0' : '#0f172a',
              }}
            >
              HG.Cash
            </Typography>
            <Typography
              sx={{
                fontSize: '0.67rem',
                lineHeight: 1,
                color: dark ? 'rgba(148,163,184,0.6)' : '#94a3b8',
                letterSpacing: '0.02em',
                mt: '2px',
              }}
            >
              Webhook Gateway
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ height: '1px', bgcolor: sidebarBorder, mx: 2 }} />

      {/* Nav */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, pt: 1.5 }}>
        <Typography
          sx={{
            px: 1.5, mb: 0.75, display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: dark ? 'rgba(100,116,139,0.7)' : '#94a3b8',
          }}
        >
          General
        </Typography>
        <List disablePadding>
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavItem
              key={path}
              path={path}
              label={label}
              Icon={Icon}
              active={location.pathname.startsWith(path)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </List>
      </Box>

      <Box sx={{ height: '1px', bgcolor: sidebarBorder, mx: 2 }} />

      {/* User footer */}
      <Box sx={{ px: 1.5, py: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '10px',
            borderRadius: '10px',
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${sidebarBorder}`,
            mb: 1,
          }}
        >
          <Avatar
            sx={{
              width: 30, height: 30,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              fontSize: '0.7rem',
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: '0 0 10px rgba(99,102,241,0.35)',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{ fontWeight: 600, fontSize: '0.78rem', lineHeight: 1.3, color: dark ? '#e2e8f0' : '#0f172a' }}
              noWrap
            >
              {user?.name}
            </Typography>
            <Typography
              sx={{ fontSize: '0.68rem', lineHeight: 1.2, color: dark ? '#64748b' : '#94a3b8', textTransform: 'capitalize' }}
              noWrap
            >
              {user?.role}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'} placement="top">
            <IconButton
              size="small"
              onClick={toggle}
              sx={{
                flex: 1,
                borderRadius: '8px',
                border: `1px solid ${sidebarBorder}`,
                py: 0.8,
                color: dark ? '#94a3b8' : '#64748b',
                '&:hover': {
                  bgcolor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: dark ? '#e2e8f0' : '#0f172a',
                },
              }}
            >
              {dark ? <LightMode sx={{ fontSize: 15 }} /> : <DarkMode sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Cerrar sesión" placement="top">
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                flex: 1,
                borderRadius: '8px',
                border: `1px solid ${sidebarBorder}`,
                py: 0.8,
                color: dark ? '#64748b' : '#94a3b8',
                '&:hover': {
                  bgcolor: 'rgba(239,68,68,0.1)',
                  borderColor: 'rgba(239,68,68,0.4)',
                  color: '#ef4444',
                },
              }}
            >
              <Logout sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { sm: 'none' },
          bgcolor: dark ? '#080e1d' : '#ffffff',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'}`,
          color: 'text.primary',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: '52px !important', px: 2 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} size="small" sx={{ mr: 1.5 }}>
            <MenuIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              width: 28, height: 28,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mr: 1,
              boxShadow: '0 0 12px rgba(99,102,241,0.4)',
            }}
          >
            <Webhook sx={{ fontSize: 16, color: '#fff' }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} letterSpacing="-0.01em">
            HG.Cash Gateway
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: sidebarBg,
            borderRight: `1px solid ${sidebarBorder}`,
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: `1px solid ${sidebarBorder}`,
            bgcolor: sidebarBg,
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: '100%',
          mt: { xs: '52px', sm: 0 },
          bgcolor: 'background.default',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            p: { xs: 1, sm: 2, md: 2.5 },
            maxWidth: 'none',
            mx: 0,
            width: '100%',
            minWidth: 0,
            overflowX: 'hidden',
          }}
        >
          <Box sx={{ width: '100%', minWidth: 0 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
