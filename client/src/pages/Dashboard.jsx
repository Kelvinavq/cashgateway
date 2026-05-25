import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Grid, LinearProgress, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Typography,
} from '@mui/material';
import {
  AccountTreeOutlined, AccessTime, CheckCircle, ErrorOutlined, GppMaybe,
  HubOutlined, PaidOutlined, Refresh, ReportProblemOutlined, SendOutlined,
  ShieldOutlined, SpeedOutlined, SwapHoriz, TaskAlt, TrendingUp,
} from '@mui/icons-material';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const tone = {
  blue:   { main: '#3b82f6', soft: 'rgba(59,130,246,0.10)',  line: 'rgba(59,130,246,0.22)',  dim: 'rgba(59,130,246,0.04)'  },
  green:  { main: '#10b981', soft: 'rgba(16,185,129,0.10)',  line: 'rgba(16,185,129,0.22)',  dim: 'rgba(16,185,129,0.04)'  },
  amber:  { main: '#f59e0b', soft: 'rgba(245,158,11,0.10)',  line: 'rgba(245,158,11,0.22)',  dim: 'rgba(245,158,11,0.04)'  },
  red:    { main: '#ef4444', soft: 'rgba(239,68,68,0.10)',   line: 'rgba(239,68,68,0.22)',   dim: 'rgba(239,68,68,0.04)'   },
  violet: { main: '#8b5cf6', soft: 'rgba(139,92,246,0.10)',  line: 'rgba(139,92,246,0.22)',  dim: 'rgba(139,92,246,0.04)'  },
  cyan:   { main: '#06b6d4', soft: 'rgba(6,182,212,0.10)',   line: 'rgba(6,182,212,0.22)',   dim: 'rgba(6,182,212,0.04)'   },
  slate:  { main: '#64748b', soft: 'rgba(100,116,139,0.10)', line: 'rgba(100,116,139,0.18)', dim: 'rgba(100,116,139,0.03)' },
};

const providerStatus = {
  pending:  { label: 'Pendiente', color: tone.amber.main, bg: tone.amber.soft },
  paid:     { label: 'Pagado',    color: tone.green.main, bg: tone.green.soft },
  rejected: { label: 'Rechazado', color: tone.red.main,   bg: tone.red.soft   },
};

function n(v) { return Number(v || 0); }
function pct(part, total) {
  const b = n(total);
  return b ? Math.max(0, Math.min(100, Math.round((n(part) / b) * 100))) : 0;
}
function fmtNum(v) { return new Intl.NumberFormat('es-AR').format(n(v)); }
function fmtARS(v) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n(v));
}
function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function MetricCard({ label, value, hint, Icon, color = 'blue', loading }) {
  const c = tone[color] || tone.blue;
  return (
    <Card sx={{
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 28px ${c.soft}`,
        borderColor: c.line,
      },
    }}>
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${c.main}bb, ${c.main})`,
        borderRadius: '2px 2px 0 0',
      }} />
      <CardContent sx={{ pt: 2.5, px: { xs: 1.75, sm: 2 }, pb: '18px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              color: 'text.secondary', fontSize: '0.64rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.09em', mb: 1.25,
            }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={110} height={38} sx={{ transform: 'none', borderRadius: 1 }} />
            ) : (
              <Typography sx={{
                fontSize: { xs: '1.65rem', md: '1.9rem' }, fontWeight: 900, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
              }}>
                {value}
              </Typography>
            )}
            {hint && (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.69rem', mt: 1, lineHeight: 1.45 }}>
                {hint}
              </Typography>
            )}
          </Box>
          <Box sx={{
            width: 42, height: 42, borderRadius: 2,
            bgcolor: c.soft, border: `1px solid ${c.line}`, color: c.main,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon sx={{ fontSize: 22 }} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function Panel({ title, subtitle, action, children, noPad, sx }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      <Box sx={{
        px: 2, py: 1.5,
        borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 1.5, flexShrink: 0,
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.87rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.68rem', mt: 0.3, lineHeight: 1.3 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && (
          <Box sx={{
            width: 30, height: 30, borderRadius: 1.5, bgcolor: 'action.hover',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {action}
          </Box>
        )}
      </Box>
      <Box sx={{ p: noPad ? 0 : 2, flex: 1, overflow: 'hidden' }}>
        {children}
      </Box>
    </Card>
  );
}

function ProgressRow({ label, value, total, color = 'blue', trailing, loading }) {
  const c = tone[color] || tone.blue;
  const percent = pct(value, total);
  return (
    <Box sx={{ mb: 1.65, '&:last-child': { mb: 0 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={0.6} alignItems="baseline">
          {loading ? (
            <Skeleton width={54} height={15} sx={{ transform: 'none' }} />
          ) : (
            <>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {trailing ?? fmtNum(value)}
              </Typography>
              {!trailing && (
                <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: c.main }}>
                  {percent}%
                </Typography>
              )}
            </>
          )}
        </Stack>
      </Stack>
      <Box sx={{ height: 6, borderRadius: 99, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Box sx={{
          height: '100%',
          width: loading ? 0 : `${percent}%`,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${c.main}99, ${c.main})`,
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </Box>
    </Box>
  );
}

function StatBlock({ label, value, color = 'blue', Icon, loading }) {
  const c = tone[color] || tone.blue;
  return (
    <Box sx={{
      p: 1.2, borderRadius: 1.5,
      border: '1px solid', borderColor: 'divider',
      display: 'flex', alignItems: 'center', gap: 1.1,
      transition: 'border-color 0.15s, background-color 0.15s',
      '&:hover': { borderColor: c.line, bgcolor: c.dim },
    }}>
      {Icon && (
        <Box sx={{
          width: 30, height: 30, borderRadius: 1.25,
          bgcolor: c.soft, color: c.main,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon sx={{ fontSize: 15 }} />
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{
          color: c.main, fontWeight: 900, fontSize: '1.05rem',
          lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>
          {loading ? <Skeleton width={30} height={18} sx={{ transform: 'none' }} /> : fmtNum(value)}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.64rem', mt: 0.35, fontWeight: 600, lineHeight: 1.2 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function ProviderChip({ status }) {
  const c = providerStatus[status] || { label: status || '-', color: tone.slate.main, bg: tone.slate.soft };
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 0.85, py: 0.3, borderRadius: 0.75,
      bgcolor: c.bg, color: c.color,
      fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap',
    }}>
      <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'currentColor', flexShrink: 0 }} />
      {c.label}
    </Box>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <Box sx={{ py: 5, textAlign: 'center' }}>
      <Box sx={{
        width: 42, height: 42, mx: 'auto', mb: 1.5, borderRadius: 2,
        bgcolor: tone.green.soft, color: tone.green.main,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', mb: 0.4 }}>{title}</Typography>
      {text && <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem', lineHeight: 1.4 }}>{text}</Typography>}
    </Box>
  );
}

const TABLE_COLS = ['Fecha', 'Dominio', 'Monto', 'Proveedor', 'Resolucion', 'Entrega', 'Ref.'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setRefreshing(true);
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data.data);
      setLastUpdated(new Date());
    } catch {
      toast.error('Error al cargar estadisticas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useSocket({
    'movement:new':        () => fetchStats({ quiet: true }),
    'movement:unresolved': () => fetchStats({ quiet: true }),
    'movement:resolved':   () => fetchStats({ quiet: true }),
    'movement:updated':    () => fetchStats({ quiet: true }),
    'delivery:updated':    () => fetchStats({ quiet: true }),
    'stats:updated':       () => fetchStats({ quiet: true }),
  });

  const s = stats || {};
  const movements = s.movements || {};
  const deliveries = s.deliveries || {};
  const security   = s.security   || {};
  const providers  = s.providers  || {};

  const deliveryTotal = n(deliveries.success) + n(deliveries.failed) + n(deliveries.pending) + n(deliveries.dead);
  const successRate   = pct(deliveries.success, deliveryTotal);
  const paidRate      = pct(movements.provider_paid, movements.total);
  const riskCount     = n(movements.unresolved) + n(deliveries.failed) + n(deliveries.dead) + n(deliveries.ack_invalid);

  const headline = useMemo(() => [
    {
      label: 'Volumen recibido',
      value: fmtARS(movements.total_ars_received),
      hint:  `${fmtNum(movements.inbound)} entradas · ${fmtNum(movements.total)} movimientos`,
      Icon:  PaidOutlined, color: 'green',
    },
    {
      label: 'Pagos confirmados',
      value: fmtNum(movements.provider_paid),
      hint:  `${paidRate}% del total informado por proveedor`,
      Icon:  TaskAlt, color: 'blue',
    },
    {
      label: 'Entrega saludable',
      value: `${successRate}%`,
      hint:  `${fmtNum(deliveries.success)} OK · ${fmtNum(deliveries.pending)} en cola`,
      Icon:  SendOutlined,
      color: successRate >= 90 ? 'green' : successRate >= 70 ? 'amber' : 'red',
    },
    {
      label: 'Atencion requerida',
      value: fmtNum(riskCount),
      hint:  'No resueltos, fallas, DLQ o ACK invalidos',
      Icon:  ReportProblemOutlined,
      color: riskCount ? 'red' : 'green',
    },
  ], [deliveries, movements, paidRate, riskCount, successRate]);

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>

      {/* ── Header ── */}
      <Box sx={{
        mb: 2.5, px: { xs: 1.75, sm: 2.25 }, py: { xs: 1.75, sm: 2 },
        borderRadius: 2, border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', position: 'relative', overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(135deg, ${tone.blue.dim} 0%, transparent 55%)`,
        },
      }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.65 }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: 1.75, flexShrink: 0,
                background: `linear-gradient(135deg, ${tone.blue.soft}, ${tone.violet.soft})`,
                border: `1px solid ${tone.blue.line}`, color: tone.blue.main,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <HubOutlined sx={{ fontSize: 19 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1, letterSpacing: '-0.01em' }}>
                Operacion FlowHG
              </Typography>
            </Stack>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.81rem', maxWidth: 720, lineHeight: 1.5 }}>
              Estado del gateway · resolucion de cuentas HG Cash · entregas a dominios · actualizaciones de pago
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.85} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.75,
              px: 1.1, py: 0.6, borderRadius: 99,
              bgcolor: tone.green.soft, border: `1px solid ${tone.green.line}`, color: tone.green.main,
            }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor',
                '@keyframes livepulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
                animation: 'livepulse 2s ease-in-out infinite',
              }} />
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800 }}>En vivo</Typography>
            </Box>

            {lastUpdated && (
              <Tooltip title="Ultima actualizacion">
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.65,
                  px: 1.1, py: 0.6, borderRadius: 99,
                  border: '1px solid', borderColor: 'divider', cursor: 'default',
                }}>
                  <AccessTime sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {lastUpdated.toLocaleTimeString('es-AR', { timeStyle: 'short' })}
                  </Typography>
                </Box>
              </Tooltip>
            )}

            <Button
              size="small" variant="outlined"
              startIcon={<Refresh sx={{ fontSize: '15px !important' }} />}
              disabled={refreshing}
              onClick={() => fetchStats()}
              sx={{ fontSize: '0.74rem', px: 1.5, py: 0.55 }}
            >
              Actualizar
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* ── KPI Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {headline.map(item => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <MetricCard {...item} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Pipeline · Payment · Risk ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>

        <Grid item xs={12} lg={5}>
          <Panel
            title="Salud del pipeline"
            subtitle="Resolucion, entrega y ACK del flujo completo"
            action={<ShieldOutlined sx={{ fontSize: 17, color: tone.blue.main }} />}
          >
            <ProgressRow
              label="Movimientos resueltos"
              value={n(movements.resolved) + n(movements.manually_resolved) + n(movements.multi_destination)}
              total={movements.total} color="blue" loading={loading}
            />
            <ProgressRow label="Entregas exitosas" value={deliveries.success} total={deliveryTotal} color="green" loading={loading} />
            <ProgressRow
              label="Updates entregados"
              value={deliveries.updates_delivered}
              total={Math.max(n(deliveries.update_success), n(deliveries.updates_delivered), 1)}
              color="cyan" trailing={`${fmtNum(deliveries.updates_delivered)} entregados`} loading={loading}
            />
            <ProgressRow
              label="ACK validos"
              value={deliveries.ack_valid}
              total={n(deliveries.ack_valid) + n(deliveries.ack_invalid)}
              color="violet" loading={loading}
            />
            <Grid container spacing={0.85} sx={{ mt: 1.75 }}>
              <Grid item xs={6}><StatBlock label="Inicial OK"   value={deliveries.initial_success} color="green"  loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Update OK"    value={deliveries.update_success}  color="cyan"   loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="DLQ"          value={deliveries.dead}            color="red"    loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="ACK invalido" value={deliveries.ack_invalid}     color="amber"  loading={loading} /></Grid>
            </Grid>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Panel
            title="Estados de pago"
            subtitle="Resultado comercial informado por el proveedor"
            action={<TrendingUp sx={{ fontSize: 17, color: tone.green.main }} />}
          >
            <ProgressRow label="Pagados"    value={movements.provider_paid}     total={movements.total} color="green" loading={loading} />
            <ProgressRow label="Pendientes" value={movements.provider_pending}  total={movements.total} color="amber" loading={loading} />
            <ProgressRow label="Rechazados" value={movements.provider_rejected} total={movements.total} color="red"   loading={loading} />
            <Grid container spacing={0.85} sx={{ mt: 1.75 }}>
              <Grid item xs={4}><StatBlock label="Entrada" value={movements.inbound}           color="blue"   loading={loading} /></Grid>
              <Grid item xs={4}><StatBlock label="Salida"  value={movements.outbound}          color="violet" loading={loading} /></Grid>
              <Grid item xs={4}><StatBlock label="Multi"   value={movements.multi_destination} color="cyan"   loading={loading} /></Grid>
            </Grid>
          </Panel>
        </Grid>

        <Grid item xs={12} lg={3}>
          <Panel
            title="Riesgo y seguridad"
            subtitle="Eventos que requieren atencion"
            action={<GppMaybe sx={{ fontSize: 17, color: riskCount ? tone.red.main : tone.green.main }} />}
          >
            <Grid container spacing={0.85}>
              <Grid item xs={6} lg={12}><StatBlock label="No resueltos"     value={movements.unresolved}        color="red"   loading={loading} /></Grid>
              <Grid item xs={6} lg={12}><StatBlock label="Rate limits"      value={security.rate_limit_hits}    color="amber" loading={loading} /></Grid>
              <Grid item xs={6} lg={12}><StatBlock label="Errores webhook"  value={security.webhook_errors}     color="red"   loading={loading} /></Grid>
              <Grid item xs={6} lg={12}><StatBlock label="Proveedores activos" value={providers.active}         color="blue"  loading={loading} /></Grid>
            </Grid>
          </Panel>
        </Grid>

      </Grid>

      {/* ── Movements Table · Incidents ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>

        <Grid item xs={12} xl={8}>
          <Panel
            title="Ultimos movimientos"
            subtitle="Pagos recibidos y estado de entrega al dominio"
            action={<SwapHoriz sx={{ fontSize: 17, color: tone.violet.main }} />}
            noPad
          >
            <TableContainer sx={{ overflowX: 'auto', maxHeight: 420 }}>
              <Table size="small" stickyHeader sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    {TABLE_COLS.map(h => (
                      <TableCell key={h} sx={{
                        fontSize: '0.65rem', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(7)].map((__, j) => (
                          <TableCell key={j}><Skeleton height={13} sx={{ transform: 'none' }} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !s.recent_movements?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ border: 'none', p: 0 }}>
                        <EmptyState icon={CheckCircle} title="Sin movimientos todavia" text="Cuando llegue el primer webhook, va a aparecer aca." />
                      </TableCell>
                    </TableRow>
                  ) : s.recent_movements.map((m, idx) => (
                    <TableRow
                      key={m.id}
                      hover
                      sx={{ bgcolor: idx % 2 === 0 ? 'transparent' : 'action.hover' }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.71rem', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDate(m.received_at)}
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.2 }}>
                          {m.domain_name || '-'}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.64rem', fontFamily: 'monospace', lineHeight: 1.2, mt: 0.2 }}>
                          {m.domain_hostname || m.destination_domain_raw || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: tone.green.main, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtARS(m.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell><ProviderChip status={m.provider_status} /></TableCell>
                      <TableCell><StatusChip status={m.resolution_status} /></TableCell>
                      <TableCell>
                        <StatusChip status={m.delivery_status || (m.resolution_status === 'unresolved' ? 'unresolved' : 'pending')} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.68rem', fontVariantNumeric: 'tabular-nums' }}>
                        {m.coelsa_code || m.hg_id || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Panel>
        </Grid>

        <Grid item xs={12} xl={4}>
          <Panel
            title="Incidentes de entrega"
            subtitle="Fallos recientes, DLQ y errores de destino"
            action={<ErrorOutlined sx={{ fontSize: 17, color: tone.red.main }} />}
          >
            {loading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} height={90} sx={{ borderRadius: 1.5, mb: 1, transform: 'none' }} />
              ))
            ) : !s.recent_failed_deliveries?.length ? (
              <EmptyState icon={CheckCircle} title="Sin fallas recientes" text="Las entregas estan respondiendo correctamente." />
            ) : (
              <Stack spacing={1}>
                {s.recent_failed_deliveries.map((d) => (
                  <Box key={d.id} sx={{
                    p: 1.3, borderRadius: 1.5,
                    border: '1px solid', borderColor: 'divider',
                    borderLeft: `3px solid ${tone.red.main}`,
                    bgcolor: tone.red.dim,
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: tone.red.soft },
                  }}>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.65 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', lineHeight: 1.2 }} noWrap>
                          {d.domain_name || '-'}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.65rem', mt: 0.2, lineHeight: 1.2 }}>
                          {d.delivery_kind === 'update' ? 'Update' : 'Alta'} · {fmtDate(d.updated_at)}
                        </Typography>
                      </Box>
                      <StatusChip status={d.status} />
                    </Stack>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.69rem', lineHeight: 1.5, mb: 0.9 }}>
                      {d.last_error?.substring(0, 135) || 'Error sin detalle'}
                    </Typography>
                    <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Box sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, bgcolor: tone.slate.soft }}>
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtNum(d.attempts)} intentos
                        </Typography>
                      </Box>
                      {d.last_http_status && (
                        <Box sx={{ px: 0.75, py: 0.2, borderRadius: 0.75, bgcolor: tone.amber.soft, color: tone.amber.main }}>
                          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            HTTP {d.last_http_status}
                          </Typography>
                        </Box>
                      )}
                      {d.provider_status && <ProviderChip status={d.provider_status} />}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Panel>
        </Grid>

      </Grid>

      {/* ── Resolution · Delivery Performance ── */}
      <Grid container spacing={2}>

        <Grid item xs={12} md={6}>
          <Panel
            title="Resolucion de destino"
            subtitle="Como se estan asignando las cuentas y dominios"
            action={<AccountTreeOutlined sx={{ fontSize: 17, color: tone.cyan.main }} />}
          >
            <Grid container spacing={0.85}>
              <Grid item xs={6}><StatBlock label="Por dominio" value={movements.destination_domain_resolved}          color="cyan"   loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Manual"      value={movements.manually_resolved}                    color="violet" loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Invalidos"   value={security.invalid_destination_domains}           color="amber"  loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Parciales"   value={security.destination_domains_partial_match}     color="blue"   loading={loading} /></Grid>
            </Grid>
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel
            title="Rendimiento de entregas"
            subtitle="Volumen de entregas y actualizaciones confirmadas"
            action={<SpeedOutlined sx={{ fontSize: 17, color: tone.green.main }} />}
          >
            <Grid container spacing={0.85}>
              <Grid item xs={6}><StatBlock label="Entregas OK"   value={deliveries.success}          color="green"  loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Pendientes"    value={deliveries.pending}           color="amber"  loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Updates OK"    value={deliveries.update_success}   color="cyan"   loading={loading} /></Grid>
              <Grid item xs={6}><StatBlock label="Multi destino" value={deliveries.multi_destination} color="violet" loading={loading} /></Grid>
            </Grid>
          </Panel>
        </Grid>

      </Grid>
    </Box>
  );
}
