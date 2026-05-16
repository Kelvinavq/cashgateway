import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, CheckCircle, ReportProblemOutlined,
  HourglassEmpty, AttachMoney, SwapHoriz,
} from '@mui/icons-material';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const CARD_COLORS = {
  indigo: { icon: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
  green: { icon: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  amber: { icon: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  cyan: { icon: '#06b6d4', bg: 'rgba(6,182,212,0.10)' },
  emerald: { icon: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  red: { icon: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  orange: { icon: '#f97316', bg: 'rgba(249,115,22,0.10)' },
};

function StatCard({ label, value, Icon, colorKey = 'indigo', loading, accent }) {
  const c = CARD_COLORS[colorKey];

  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {accent && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            bgcolor: c.icon,
            opacity: 0.7,
          }}
        />
      )}
      <CardContent sx={{ p: { xs: '12px !important', sm: '14px !important' } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '9px',
              bgcolor: c.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 19, color: c.icon }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.72rem' }}
              noWrap
            >
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={56} height={26} sx={{ transform: 'none' }} />
            ) : (
              <Typography sx={{ fontWeight: 700, fontSize: '1.35rem', lineHeight: 1, color: c.icon }}>
                {value ?? '—'}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function fmtARS(n) {
  if (!n) return '$0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data.data);
    } catch {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useSocket({
    'movement:new': fetchStats,
    'delivery:updated': fetchStats,
    'stats:updated': fetchStats,
  });

  const s = stats;

  const kpis = [
    { label: 'Total Movimientos', value: s?.movements.total, Icon: SwapHoriz, colorKey: 'indigo' },
    { label: 'Entradas', value: s?.movements.inbound, Icon: TrendingDown, colorKey: 'green' },
    { label: 'Salidas', value: s?.movements.outbound, Icon: TrendingUp, colorKey: 'amber' },
    { label: 'ARS Recibido', value: loading ? null : fmtARS(s?.movements.total_ars_received), Icon: AttachMoney, colorKey: 'cyan' },
    { label: 'Entregas OK', value: s?.deliveries.success, Icon: CheckCircle, colorKey: 'emerald' },
    { label: 'Fallidas', value: s?.deliveries.failed, Icon: ReportProblemOutlined, colorKey: 'red' },
    { label: 'Pendientes', value: s?.deliveries.pending, Icon: HourglassEmpty, colorKey: 'orange' },
  ];

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.35rem', sm: '1.5rem' } }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
          Resumen en tiempo real del gateway
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: { xs: 1.5, sm: 2 } }}>
        {kpis.map((k) => (
          <Grid key={k.label} item xs={12} sm={6} md={4} lg={3}>
            <StatCard {...k} loading={loading} accent />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0.5 }}>
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <Box
              sx={{
                px: { xs: 1.5, sm: 2 },
                pt: { xs: 1.5, sm: 2 },
                pb: 1,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography variant="subtitle2">Últimos Movimientos</Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: 'rgba(16,185,129,0.1)',
                  borderRadius: '20px',
                  px: 1.25,
                  py: 0.4,
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%,100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    },
                  }}
                />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#10b981' }}>
                  En vivo
                </Typography>
              </Box>
            </Box>

            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Fecha</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Dominio</TableCell>
                    <TableCell>Monto</TableCell>
                    <TableCell>Dir.</TableCell>
                    <TableCell>Entrega</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(5)].map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton sx={{ transform: 'none' }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !s?.recent_movements?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                        Sin movimientos aún
                      </TableCell>
                    </TableRow>
                  ) : (
                    s.recent_movements.map((m) => (
                      <TableRow key={m.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                          {fmtDate(m.received_at)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{m.domain_name || '—'}</TableCell>
                        <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtARS(m.amount)}</TableCell>
                        <TableCell><StatusChip status={m.direction} /></TableCell>
                        <TableCell><StatusChip status={m.delivery_status || 'pending'} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: { xs: 1.5, sm: 2 }, pb: 1 }}>
              <Typography variant="subtitle2">Entregas Fallidas Recientes</Typography>
            </Box>
            <Box sx={{ px: { xs: 1.25, sm: 1.5 }, pb: { xs: 1.25, sm: 1.5 } }}>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <Skeleton key={i} height={64} sx={{ borderRadius: '8px', mb: 1, transform: 'none' }} />
                ))
              ) : !s?.recent_failed_deliveries?.length ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(16,185,129,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 1.5,
                    }}
                  >
                    <CheckCircle sx={{ color: '#10b981', fontSize: 26 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Sin entregas fallidas
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Todo entregado correctamente
                  </Typography>
                </Box>
              ) : (
                s.recent_failed_deliveries.map((d) => (
                  <Box
                    key={d.id}
                    sx={{
                      p: 1.5,
                      borderRadius: '8px',
                      border: '1px solid rgba(239,68,68,0.2)',
                      bgcolor: 'rgba(239,68,68,0.06)',
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
                      <Typography variant="caption" fontWeight={700} color="error.main" noWrap>
                        {d.domain_name}
                      </Typography>
                      <Typography variant="caption" fontWeight={700} color="text.primary" noWrap>
                        {fmtARS(d.amount)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                    >
                      {d.last_error?.substring(0, 90) || 'Error desconocido'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {d.attempts} intentos
                      </Typography>
                      {d.last_http_status && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          · HTTP {d.last_http_status}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
