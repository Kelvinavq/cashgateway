import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, CircularProgress, Alert, Stack,
} from '@mui/material';
import { Visibility, VisibilityOff, Webhook } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      {/* Background decoration */}
      <Box
        sx={{
          position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
        }}
      >
        <Box sx={{
          position: 'absolute',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          top: '-150px', left: '-150px',
        }} />
        <Box sx={{
          position: 'absolute',
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
          bottom: '-100px', right: '-100px',
        }} />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 52, height: 52,
              borderRadius: '14px',
              bgcolor: 'primary.main',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
            }}
          >
            <Webhook sx={{ fontSize: 28, color: '#fff' }} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700} letterSpacing="-0.02em">
              HG.Cash Gateway
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Panel de administración
            </Typography>
          </Box>
        </Stack>

        <Card>
          <CardContent sx={{ p: '24px !important' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Iniciar sesión
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Ingresa tus credenciales para continuar
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2, borderRadius: '8px', fontSize: '0.8125rem', py: 0.5 }}
              >
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                size="small"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                sx={{ mb: 1.5 }}
                autoComplete="email"
              />
              <TextField
                label="Contraseña"
                type={showPass ? 'text' : 'password'}
                fullWidth
                required
                size="small"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPass(p => !p)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                      >
                        {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2.5 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="medium"
                disabled={loading}
                sx={{ py: 1.1, fontWeight: 700 }}
              >
                {loading ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                {loading ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 2 }}>
          HG.Cash Webhook Gateway © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}
