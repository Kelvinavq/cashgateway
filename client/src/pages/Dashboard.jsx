import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, CheckCircle, ReportProblemOutlined,
  HourglassEmpty, AttachMoney, SwapHoriz, TaskAlt, WarningAmber, BuildCircle,
  Source, MailOutlined, GppMaybe, SpeedOutlined, RotateRight,
  ErrorOutlined, Block,
} from '@mui/icons-material';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const CARD_COLORS = {
  indigo:  { icon: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  green:   { icon: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  amber:   { icon: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  cyan:    { icon: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  emerald: { icon: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  red:     { icon: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  orange:  { icon: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  teal:    { icon: '#14b8a6', bg: 'rgba(20,184,166,0.12)'  },
  rose:    { icon: '#f43f5e', bg: 'rgba(244,63,94,0.12)'   },
  violet:  { icon: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
};

function StatCard({ label, value, Icon, colorKey = 'indigo', loading, accent }) {
  const c = CARD_COLORS[colorKey];
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {accent && (
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: `linear-gradient(90deg, ${c.icon} 0%, ${c.icon}50 60%, transparent 100%)`,
        }} />
      )}
      <CardContent sx={{ p: { xs: '14px !important', sm: '16px !important' } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 38, height: 38, borderRadius: '10px',
            background: `linear-gradient(135deg, ${c.bg} 0%, ${c.icon}18 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 3px 10px ${c.icon}20`,
          }}>
            <Icon sx={{ fontSize: 18, color: c.icon }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              sx={{ display: 'block', mb: 0.25, fontWeight: 500, fontSize: '0.68rem', color: 'text.secondary' }}
              noWrap
            >
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={48} height={26} sx={{ transform: 'none' }} />
            ) : (
              <Typography sx={{
                fontWeight: 800,
                fontSize: { xs: '1.2rem', sm: '1.35rem' },
                lineHeight: 1,
                color: c.icon,
                letterSpacing: '-0.02em',
              }}>
                {value ?? '—'}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SectionLabel({ label, accentColor = '#6366f1' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
      <Box sx={{
        width: '3px', height: 14, borderRadius: '2px',
        background: `linear-gradient(180deg, ${accentColor}, ${accentColor}60)`,
        flexShrink: 0,
      }} />
      <Typography sx={{
        fontSize: '0.6rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'text.disabled',
      }}>
        {label}
      </Typography>
    </Box>
  );
}

function fmtARS(n) {
  if (!n) return '$0';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
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

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useSocket({
    'movement:new':        fetchStats,
    'movement:unresolved': fetchStats,
    'movement:resolved':   fetchStats,
    'delivery:updated':    fetchStats,
    'stats:updated':       fetchStats,
  });

  const s = stats;

  // ── Groups ─────────────────────────────────────────────────────
  const movimientosKpis = [
    { label: 'Total Movimientos', value: s?.movements.total,           Icon: SwapHoriz,  colorKey: 'indigo' },
    { label: 'Entradas',          value: s?.movements.inbound,         Icon: TrendingDown, colorKey: 'green' },
    { label: 'Salidas',           value: s?.movements.outbound,        Icon: TrendingUp,  colorKey: 'amber' },
    { label: 'ARS Recibido',      value: loading ? null : fmtARS(s?.movements.total_ars_received), Icon: AttachMoney, colorKey: 'cyan' },
  ];

  const resolucionKpis = [
    { label: 'Resueltos',        value: s?.movements.resolved,          Icon: TaskAlt,     colorKey: 'teal'   },
    { label: 'No resueltos',     value: s?.movements.unresolved,        Icon: WarningAmber, colorKey: 'rose'   },
    { label: 'Resuelto manual',  value: s?.movements.manually_resolved, Icon: BuildCircle,  colorKey: 'violet' },
  ];

  const entregasKpis = [
    { label: 'Entregas OK',  value: s?.deliveries.success, Icon: CheckCircle,           colorKey: 'emerald' },
    { label: 'Fallidas',     value: s?.deliveries.failed,  Icon: ReportProblemOutlined, colorKey: 'red'     },
    { label: 'Pendientes',   value: s?.deliveries.pending, Icon: HourglassEmpty,        colorKey: 'orange'  },
  ];

  const seguridadKpis = [
    { label: 'Proveedores activos', value: s?.providers.active,           Icon: Source,        colorKey: 'indigo' },
    { label: 'Dead Letter (DLQ)',   value: s?.deliveries.dead,            Icon: Block,         colorKey: 'violet' },
    { label: 'ACK válidos',         value: s?.deliveries.ack_valid,       Icon: MailOutlined,  colorKey: 'teal'   },
    { label: 'ACK inválidos',       value: s?.deliveries.ack_invalid,     Icon: GppMaybe,      colorKey: 'rose'   },
    { label: 'Rate limits',         value: s?.security.rate_limit_hits,   Icon: SpeedOutlined, colorKey: 'amber'  },
    { label: 'Reactivadas',         value: s?.security.reactivated,       Icon: RotateRight,   colorKey: 'green'  },
    { label: 'Errores webhook',     value: s?.security.webhook_errors,    Icon: ErrorOutlined, colorKey: 'red'    },
  ];

  return (
    <Box sx={{ minWidth: 0 }}>

      {/* ── Page Header ── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Resumen en tiempo real del gateway
        </Typography>
        <Box sx={{
          height: '1px', mt: 1.5,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.55), rgba(139,92,246,0.25) 40%, transparent 75%)',
        }} />
      </Box>

      {/* ── Movimientos ── */}
      <SectionLabel label="Movimientos" accentColor="#6366f1" />
      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 2.5 }}>
        {movimientosKpis.map(k => (
          <Grid key={k.label} item xs={6} sm={3}>
            <StatCard {...k} loading={loading} accent />
          </Grid>
        ))}
      </Grid>

      {/* ── Resolución + Entregas (side by side on md+) ── */}
      <Grid container spacing={{ xs: 2, md: 2.5 }} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={5}>
          <SectionLabel label="Resolución" accentColor="#8b5cf6" />
          <Grid container spacing={{ xs: 1, sm: 1.5 }}>
            {resolucionKpis.map(k => (
              <Grid key={k.label} item xs={6} sm={4} md={4}>
                <StatCard {...k} loading={loading} accent />
              </Grid>
            ))}
          </Grid>
        </Grid>
        <Grid item xs={12} md={7}>
          <SectionLabel label="Entregas" accentColor="#10b981" />
          <Grid container spacing={{ xs: 1, sm: 1.5 }}>
            {entregasKpis.map(k => (
              <Grid key={k.label} item xs={6} sm={4}>
                <StatCard {...k} loading={loading} accent />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {/* ── Seguridad & Enterprise ── */}
      <SectionLabel label="Seguridad & Enterprise" accentColor="#f59e0b" />
      <Grid container spacing={{ xs: 1, sm: 1.5 }} sx={{ mb: 3 }}>
        {seguridadKpis.map(k => (
          <Grid key={k.label} item xs={6} sm={4} md={3} lg={12 / 7}>
            <StatCard {...k} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Tables ── */}
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {/* Últimos movimientos */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{
              px: { xs: 1.5, sm: 2 }, pt: { xs: 1.5, sm: 2 }, pb: 1,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}>
              <Typography variant="subtitle2" sx={{ letterSpacing: '-0.01em' }}>
                Últimos Movimientos
              </Typography>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                bgcolor: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '20px', px: 1.25, py: 0.4,
              }}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981',
                  boxShadow: '0 0 6px rgba(16,185,129,0.9)',
                  animation: 'livePulse 2s ease-in-out infinite',
                  '@keyframes livePulse': {
                    '0%,100%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.4, transform: 'scale(0.75)' },
                  },
                }} />
                <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.03em' }}>
                  En vivo
                </Typography>
              </Box>
            </Box>

            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Dominio</TableCell>
                    <TableCell>Monto</TableCell>
                    <TableCell>Dir.</TableCell>
                    <TableCell>Resolución</TableCell>
                    <TableCell>Entrega</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(6)].map((_, j) => (
                          <TableCell key={j}><Skeleton sx={{ transform: 'none' }} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !s?.recent_movements?.length ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Box sx={{ py: 5, textAlign: 'center' }}>
                          <Box sx={{
                            width: 44, height: 44, borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            mx: 'auto', mb: 1.5,
                          }}>
                            <SwapHoriz sx={{ fontSize: 22, color: 'primary.light', opacity: 0.7 }} />
                          </Box>
                          <Typography variant="body2" fontWeight={600} color="text.secondary">
                            Sin movimientos aún
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : s.recent_movements.map((m) => (
                    <TableRow key={m.id} hover
                      sx={m.resolution_status === 'unresolved' ? { bgcolor: 'rgba(239,68,68,0.04)' } : {}}>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.75rem' }}>
                        {fmtDate(m.received_at)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{m.domain_name || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtARS(m.amount)}</TableCell>
                      <TableCell><StatusChip status={m.direction} /></TableCell>
                      <TableCell><StatusChip status={m.resolution_status} /></TableCell>
                      <TableCell>
                        <StatusChip status={m.delivery_status || (m.resolution_status === 'unresolved' ? 'unresolved' : 'pending')} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Entregas fallidas */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{
              px: { xs: 1.5, sm: 2 }, pt: { xs: 1.5, sm: 2 }, pb: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}>
              <Typography variant="subtitle2" sx={{ letterSpacing: '-0.01em' }}>
                Entregas Fallidas Recientes
              </Typography>
            </Box>
            <Box sx={{ px: { xs: 1.25, sm: 1.5 }, pb: { xs: 1.25, sm: 1.5 }, pt: 1.25 }}>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <Skeleton key={i} height={68} sx={{ borderRadius: '10px', mb: 1, transform: 'none' }} />
                ))
              ) : !s?.recent_failed_deliveries?.length ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Box sx={{
                    width: 44, height: 44, borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.06))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mx: 'auto', mb: 1.5,
                    boxShadow: '0 4px 14px rgba(16,185,129,0.12)',
                  }}>
                    <CheckCircle sx={{ color: '#10b981', fontSize: 22 }} />
                  </Box>
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Sin entregas fallidas
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Todo entregado correctamente
                  </Typography>
                </Box>
              ) : s.recent_failed_deliveries.map((d) => (
                <Box key={d.id} sx={{
                  p: 1.5, borderRadius: '10px',
                  border: '1px solid rgba(239,68,68,0.15)',
                  bgcolor: 'rgba(239,68,68,0.04)',
                  mb: 1,
                  transition: 'border-color 0.15s',
                  '&:hover': { borderColor: 'rgba(239,68,68,0.28)' },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
                    <Typography variant="caption" fontWeight={700} color="error.main" noWrap>
                      {d.domain_name}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color="text.primary" noWrap>
                      {fmtARS(d.amount)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary"
                    sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', lineHeight: 1.4 }}>
                    {d.last_error?.substring(0, 90) || 'Error desconocido'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.67rem' }}>
                      {d.attempts} intentos
                    </Typography>
                    {d.last_http_status && (
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.67rem' }}>
                        · HTTP {d.last_http_status}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
