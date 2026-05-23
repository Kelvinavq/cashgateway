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

const DRAWER_WIDTH = 232;

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
    <ListItem disablePadding sx={{ mb: '2px' }}>
      <ListItemButton
        component={Link}
        to={path}
        onClick={onClick}
        selected={active}
        sx={{
          borderRadius: '8px',
          py: 1,
          px: 1.5,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: '#fff',
            '& .MuiListItemIcon-root': { color: '#fff' },
            '&:hover': { bgcolor: 'primary.dark' },
          },
          '&:not(.Mui-selected)': {
            color: 'text.secondary',
            '& .MuiListItemIcon-root': { color: 'text.secondary' },
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover', '& .MuiListItemIcon-root': { color: 'text.primary' } },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 34 }}>
          <Icon sx={{ fontSize: 18 }} />
        </ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 500, lineHeight: 1 }}
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

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 0 }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: '10px',
              bgcolor: 'primary.main',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Webhook sx={{ fontSize: 20, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }}>HG.Cash</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
              Webhook Gateway
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Nav */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, pt: 1.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 1, mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.65rem', fontWeight: 600 }}
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

      <Divider />

      {/* User footer */}
      <Box sx={{ px: 1.5, py: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'divider',
            mb: 1,
          }}
        >
          <Avatar
            sx={{
              width: 30, height: 30,
              bgcolor: 'primary.main',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{ fontWeight: 600, fontSize: '0.8rem', lineHeight: 1.3, color: 'text.primary' }}
              noWrap
            >
              {user?.name}
            </Typography>
            <Typography
              sx={{ fontSize: '0.7rem', lineHeight: 1.2, color: 'text.secondary', textTransform: 'capitalize' }}
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
              sx={{ flex: 1, borderRadius: '8px', border: '1px solid', borderColor: 'divider', py: 0.75 }}
            >
              {dark ? <LightMode sx={{ fontSize: 16 }} /> : <DarkMode sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Cerrar sesión" placement="top">
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                flex: 1, borderRadius: '8px',
                border: '1px solid', borderColor: 'divider',
                py: 0.75, color: 'error.main',
                '&:hover': { bgcolor: 'rgba(239,68,68,0.08)', borderColor: 'error.main' },
              }}
            >
              <Logout sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { sm: 'none' },
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: '52px !important', px: 2 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} size="small" sx={{ mr: 1.5 }}>
            <MenuIcon fontSize="small" />
          </IconButton>
          <Box sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1 }}>
            <Webhook sx={{ fontSize: 15, color: '#fff' }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>HG.Cash Gateway</Typography>
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
            bgcolor: 'background.paper',
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
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
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
          width: { xs: '100%', sm: `calc(100vw - ${DRAWER_WIDTH}px)` },
          mt: { xs: '52px', sm: 0 },
          bgcolor: 'background.default',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Page inner container */}
        <Box
          sx={{
            p: { xs: 1.5, sm: 2.5, md: 3 },
            maxWidth: 1400,
            mx: 'auto',
            width: '100%',
            minWidth: 0,
            overflowX: 'hidden',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
