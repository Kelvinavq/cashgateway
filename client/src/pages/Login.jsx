import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography,
  InputAdornment, IconButton, CircularProgress, Alert, Stack,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Webhook,
  BoltOutlined, LockOutlined, BarChartOutlined,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const features = [
  { Icon: BoltOutlined,    text: 'Eventos en tiempo real via WebSocket' },
  { Icon: LockOutlined,    text: 'Firmas HMAC y autenticación por tokens' },
  { Icon: BarChartOutlined, text: 'Auditoría completa de movimientos' },
];

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      toast.success('Bienvenido');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#07101f' }}>

      {/* ── Left branding panel (md+) ── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          width: '46%',
          flexShrink: 0,
          bgcolor: '#080e1d',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
          p: 6,
        }}
      >
        {/* Background orbs */}
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Box sx={{
            position: 'absolute', width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
            top: '-120px', left: '-120px',
          }} />
          <Box sx={{
            position: 'absolute', width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)',
            bottom: '-80px', right: '-80px',
          }} />
          {/* Grid */}
          <Box sx={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)`,
            backgroundSize: '44px 44px',
          }} />
        </Box>

        {/* Content */}
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 'auto' }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(99,102,241,0.45)',
            }}>
              <Webhook sx={{ fontSize: 22, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#e2e8f0', letterSpacing: '-0.02em' }}>
                HG.Cash
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#475569', letterSpacing: '0.04em' }}>
                WEBHOOK GATEWAY
              </Typography>
            </Box>
          </Box>

          {/* Hero text */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '2.2rem',
                letterSpacing: '-0.04em',
                lineHeight: 1.15,
                color: '#e2e8f0',
                mb: 1.5,
              }}
            >
              Infraestructura de{' '}
              <Box component="span" sx={{
                background: 'linear-gradient(135deg, #818cf8, #c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                pagos
              </Box>
              {' '}en tiempo real
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, mb: 3.5, maxWidth: 320 }}>
              Panel de administración para gestionar webhooks, movimientos y entregas.
            </Typography>

            {/* Features */}
            <Stack spacing={2}>
              {features.map(({ Icon, text }) => (
                <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '9px',
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon sx={{ fontSize: 16, color: '#818cf8' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>{text}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Typography sx={{ fontSize: '0.7rem', color: '#1e293b', mt: 4 }}>
            © {new Date().getFullYear()} HG.Cash Gateway
          </Typography>
        </Box>
      </Box>

      {/* ── Right form panel ── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4, md: 6 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Mobile-only background orb */}
        <Box sx={{
          display: { md: 'none' },
          position: 'fixed', inset: 0, pointerEvents: 'none',
        }}>
          <Box sx={{
            position: 'absolute', width: 600, height: 600, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)',
            top: '-180px', left: '50%', transform: 'translateX(-50%)',
          }} />
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>

          {/* Mobile-only logo */}
          <Stack
            alignItems="center"
            spacing={1.5}
            sx={{ mb: 4, display: { md: 'none' } }}
          >
            <Box sx={{
              width: 52, height: 52, borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 36px rgba(99,102,241,0.5)',
            }}>
              <Webhook sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.03em', color: '#e2e8f0' }}>
                HG.Cash Gateway
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 0.25 }}>
                Panel de administración
              </Typography>
            </Box>
          </Stack>

          {/* Form heading */}
          <Box sx={{ mb: 3 }}>
            <Typography sx={{
              fontWeight: 700, fontSize: '1.4rem',
              letterSpacing: '-0.03em', color: '#e2e8f0', lineHeight: 1.2,
            }}>
              Bienvenido de vuelta
            </Typography>
            <Typography sx={{ fontSize: '0.83rem', color: '#475569', mt: 0.5 }}>
              Ingresa tus credenciales para continuar
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5, borderRadius: '10px', fontSize: '0.8rem', py: 0.5,
                bgcolor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.22)',
                color: '#f87171',
                '& .MuiAlert-icon': { color: '#ef4444' },
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth required size="small"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              sx={{ mb: 2 }}
              autoComplete="email"
              InputProps={{ sx: { bgcolor: 'rgba(255,255,255,0.04)', '& input': { color: '#e2e8f0' } } }}
              InputLabelProps={{ sx: { color: '#475569' } }}
            />
            <TextField
              label="Contraseña"
              type={showPass ? 'text' : 'password'}
              fullWidth required size="small"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              autoComplete="current-password"
              sx={{ mb: 3 }}
              InputProps={{
                sx: { bgcolor: 'rgba(255,255,255,0.04)', '& input': { color: '#e2e8f0' } },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPass(p => !p)}
                      edge="end" size="small" tabIndex={-1}
                      sx={{ color: '#475569', '&:hover': { color: '#94a3b8' } }}
                    >
                      {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              InputLabelProps={{ sx: { color: '#475569' } }}
            />
            <Button
              type="submit" variant="contained" fullWidth size="medium"
              disabled={loading}
              sx={{ py: 1.3, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.01em' }}
            >
              {loading
                ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Ingresando…</>
                : 'Ingresar al panel'}
            </Button>
          </Box>

          <Typography sx={{ fontSize: '0.7rem', color: '#1e293b', textAlign: 'center', mt: 3 }}>
            © {new Date().getFullYear()} HG.Cash · Todos los derechos reservados
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
