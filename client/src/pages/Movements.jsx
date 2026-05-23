import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, TextField,
  Select, MenuItem, FormControl, InputLabel, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Skeleton, Stack, Chip, Paper, Divider, useMediaQuery, useTheme,
  Autocomplete,
} from '@mui/material';
import { Visibility, Refresh, Code, History, BuildCircle, WarningAmber, SwapHoriz, ContentCopy, Close } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

function formatAmount(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

const RESOLUTION_STATUS_LABELS = {
  resolved: 'Resuelto',
  unresolved: 'No resuelto',
  manually_resolved: 'Resuelto manual',
};
const RESOLUTION_METHOD_LABELS = {
  account_id: 'Account ID',
  to_cbu: 'CBU',
  to_cuit: 'CUIT',
  manual: 'Manual',
  none: 'Ninguno',
};

function ResolutionChip({ status }) {
  const colorMap = { resolved: 'success', unresolved: 'error', manually_resolved: 'warning' };
  return (
    <Chip
      label={RESOLUTION_STATUS_LABELS[status] || status || 'â€”'}
      color={colorMap[status] || 'default'}
      size="small"
      sx={{ fontSize: 11, height: 20 }}
    />
  );
}

function DetailField({ label, value, mono = false, copyable = false, onCopy }) {
  const displayValue = value === undefined || value === null || value === '' ? 'â€”' : value;
  const canCopy = copyable && displayValue !== 'â€”';

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'rgba(148,163,184,0.16)',
        bgcolor: 'rgba(15,23,42,0.24)',
        minHeight: '100%',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {label}
          </Typography>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              wordBreak: 'break-word',
              lineHeight: 1.45,
              fontFamily: mono ? 'monospace' : 'inherit',
              color: displayValue === 'â€”' ? 'text.disabled' : 'text.primary',
            }}
          >
            {displayValue}
          </Typography>
        </Box>
        {canCopy && (
          <Tooltip title="Copiar">
            <IconButton size="small" onClick={() => onCopy(displayValue, label)} sx={{ mt: -0.25, flexShrink: 0 }}>
              <ContentCopy sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}

function DetailSection({ title, subtitle, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'rgba(148,163,184,0.14)',
        bgcolor: 'rgba(2,6,23,0.35)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Stack>
      {children}
    </Paper>
  );
}

export default function Movements() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    direction: '', coelsa_code: '', cuit: '', cbu: '',
    resolution_status: '', resolution_method: '',
  });

  const [detailDialog, setDetailDialog] = useState(null);
  const [jsonDialog, setJsonDialog] = useState(null);
  const [deliveriesDialog, setDeliveriesDialog] = useState(null);
  const [deliveries, setDeliveries] = useState([]);

  const [resolveDialog, setResolveDialog] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [resolving, setResolving] = useState(false);

  const copyToClipboard = async (value, label = 'Dato') => {
    if (value === undefined || value === null || value === '') return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`${label} copiado`);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };
      const { data } = await api.get('/movements', { params });
      setRows(data.data);
      setTotal(data.pagination.total);
    } catch {
      toast.error('Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (mounted) {
        await fetchMovements();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchMovements]);

  useSocket({
    'movement:new': fetchMovements,
    'movement:unresolved': fetchMovements,
    'movement:resolved': fetchMovements,
    'delivery:updated': fetchMovements,
  });

  const openDeliveries = async (movement) => {
    setDeliveriesDialog(movement);
    try {
      const { data } = await api.get(`/movements/${movement.id}/deliveries`);
      setDeliveries(data.data);
    } catch {
      toast.error('Error al cargar entregas');
    }
  };

  const handleRetry = async (deliveryId) => {
    try {
      await api.post(`/deliveries/${deliveryId}/retry`);
      toast.success('Reintento encolado');
      if (deliveriesDialog) {
        const { data } = await api.get(`/movements/${deliveriesDialog.id}/deliveries`);
        setDeliveries(data.data);
      }
    } catch {
      toast.error('Error al reintentar');
    }
  };

  const openResolveDialog = async (movement) => {
    setResolveDialog(movement);
    setSelectedAccount(null);
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data.data.filter(a => a.is_active));
    } catch {
      toast.error('Error al cargar cuentas');
    }
  };

  const handleResolve = async () => {
    if (!selectedAccount) { toast.error('SeleccionÃ¡ una cuenta HG.Cash'); return; }
    setResolving(true);
    try {
      await api.post(`/movements/${resolveDialog.id}/resolve`, { hgcash_account_id: selectedAccount.id });
      toast.success('Movimiento resuelto y reenvÃ­o encolado');
      setResolveDialog(null);
      setSelectedAccount(null);
      fetchMovements();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al resolver movimiento');
    } finally {
      setResolving(false);
    }
  };

  const clearFilters = () => {
    setFilters({ direction: '', coelsa_code: '', cuit: '', cbu: '', resolution_status: '', resolution_method: '' });
    setPage(0);
  };

  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };
  const hideLg = { display: { xs: 'none', lg: 'table-cell' } };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Movimientos</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Historial de transacciones en tiempo real
        </Typography>
        <Box sx={{
          height: '1px', mt: 1.5,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.55), rgba(139,92,246,0.25) 40%, transparent 75%)',
        }} />
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={6} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>DirecciÃ³n</InputLabel>
                <Select value={filters.direction} label="DirecciÃ³n"
                  onChange={e => setFilters(p => ({ ...p, direction: e.target.value }))}>
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="Inbound">Inbound</MenuItem>
                  <MenuItem value="Outbound">Outbound</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>ResoluciÃ³n</InputLabel>
                <Select value={filters.resolution_status} label="ResoluciÃ³n"
                  onChange={e => setFilters(p => ({ ...p, resolution_status: e.target.value }))}>
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="resolved">Resuelto</MenuItem>
                  <MenuItem value="unresolved">No resuelto</MenuItem>
                  <MenuItem value="manually_resolved">Manual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>MÃ©todo</InputLabel>
                <Select value={filters.resolution_method} label="MÃ©todo"
                  onChange={e => setFilters(p => ({ ...p, resolution_method: e.target.value }))}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="account_id">Account ID</MenuItem>
                  <MenuItem value="to_cbu">CBU</MenuItem>
                  <MenuItem value="to_cuit">CUIT</MenuItem>
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="none">Ninguno</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField size="small" label="COELSA Code" fullWidth
                value={filters.coelsa_code}
                onChange={e => setFilters(p => ({ ...p, coelsa_code: e.target.value }))} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField size="small" label="CUIT" fullWidth
                value={filters.cuit}
                onChange={e => setFilters(p => ({ ...p, cuit: e.target.value }))} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField size="small" label="CBU" fullWidth
                value={filters.cbu}
                onChange={e => setFilters(p => ({ ...p, cbu: e.target.value }))} />
            </Grid>
            <Grid item xs={6} sm="auto">
              <Button variant="outlined" onClick={clearFilters} size="small" fullWidth={isMobile}>Limpiar</Button>
            </Grid>
            <Grid item xs={6} sm="auto">
              <Button variant="contained" onClick={() => { setPage(0); fetchMovements(); }} size="small" fullWidth={isMobile}>
                Filtrar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 480 }}>
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell sx={hideSm}>Dominio</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell sx={hideMd}>Dir.</TableCell>
                <TableCell sx={hideLg}>Cuenta</TableCell>
                <TableCell>ResoluciÃ³n</TableCell>
                <TableCell sx={hideMd}>MÃ©todo</TableCell>
                <TableCell sx={hideSm}>Entrega</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(9)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Box sx={{
                        width: 52, height: 52, borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2,
                      }}>
                        <SwapHoriz sx={{ fontSize: 26, color: 'primary.light', opacity: 0.7 }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">
                        No se encontraron movimientos
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        AjustÃ¡ los filtros o esperÃ¡ nuevas transacciones
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover
                  sx={row.resolution_status === 'unresolved' ? { bgcolor: 'rgba(239,68,68,0.04)' } : {}}>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    {formatDate(row.received_at)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>{row.domain_name || 'â€”'}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatAmount(row.amount)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideMd }}><StatusChip status={row.direction} /></TableCell>
                  <TableCell sx={{ fontSize: 11, ...hideLg }}>{row.account_name || 'â€”'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ResolutionChip status={row.resolution_status} />
                      {row.resolution_status === 'unresolved' && (
                        <Tooltip title={row.unresolved_reason || 'Sin razÃ³n'}>
                          <WarningAmber sx={{ fontSize: 14, color: 'error.main', cursor: 'help' }} />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, ...hideMd }}>
                    {RESOLUTION_METHOD_LABELS[row.resolution_method] || 'â€”'}
                  </TableCell>
                  <TableCell sx={hideSm}>
                    <StatusChip status={row.delivery_status || (row.resolution_status === 'unresolved' ? 'unresolved' : 'pending')} />
                  </TableCell>
                  <TableCell align="right" sx={{ px: 0.5 }}>
                    <Stack direction="row" spacing={0} justifyContent="flex-end">
                      <Tooltip title="Ver detalle">
                        <IconButton size="small" onClick={() => setDetailDialog(row)}>
                          <Visibility sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ver JSON">
                        <IconButton size="small" onClick={() => setJsonDialog(row)}>
                          <Code sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Historial entregas">
                        <IconButton size="small" onClick={() => openDeliveries(row)}>
                          <History sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {(row.resolution_status === 'unresolved' || row.resolution_status === 'manually_resolved') && (
                        <Tooltip title="Resolver manualmente">
                          <IconButton size="small" color="warning" onClick={() => openResolveDialog(row)}>
                            <BuildCircle sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage={isMobile ? '' : 'Por pÃ¡gina:'}
        />
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailDialog}
        onClose={() => setDetailDialog(null)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 3 },
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.98) 100%)',
            border: '1px solid rgba(148,163,184,0.16)',
          },
        }}
      >
        <DialogTitle
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderBottom: '1px solid rgba(148,163,184,0.12)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.08) 45%, transparent 100%)',
          }}
        >
          {detailDialog && (
            <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
                  Detalle de movimiento
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15, mt: 0.25 }}>
                  {detailDialog.hg_id || detailDialog.gateway_event_id || 'Movimiento'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  Recibido {formatDate(detailDialog.received_at)} · Monto {formatAmount(detailDialog.amount)}
                </Typography>
              </Box>
              <IconButton onClick={() => setDetailDialog(null)} sx={{ mt: -0.5 }}>
                <Close />
              </IconButton>
            </Stack>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: 'rgba(2,6,23,0.72)' }}>
          {detailDialog && (
            <Stack spacing={2}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderRadius: 3,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(15,23,42,0.42)',
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 1.5 }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <StatusChip status={detailDialog.direction} />
                    <ResolutionChip status={detailDialog.resolution_status} />
                    <StatusChip status={detailDialog.delivery_status || (detailDialog.resolution_status === 'unresolved' ? 'unresolved' : 'pending')} />
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopy />}
                    onClick={() => copyToClipboard([
                      `HG ID: ${detailDialog.hg_id || '—'}`,
                      `Gateway Event ID: ${detailDialog.gateway_event_id || '—'}`,
                      `Provider Event ID: ${detailDialog.provider_event_id || '—'}`,
                      `External ID: ${detailDialog.external_id || '—'}`,
                    ].join('\n'), 'Claves')}
                  >
                    Copiar claves
                  </Button>
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)' }}>
                      <Typography variant="caption" color="text.secondary" display="block">Monto</Typography>
                      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25 }}>
                        {formatAmount(detailDialog.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {detailDialog.currency || '—'} · {detailDialog.type || '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <DetailField
                      label="Cuenta HG"
                      value={detailDialog.account_name}
                      copyable
                      onCopy={copyToClipboard}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <DetailField
                      label="Dominio resuelto"
                      value={detailDialog.domain_name}
                      copyable
                      onCopy={copyToClipboard}
                    />
                  </Grid>
                </Grid>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={6}>
                  <DetailSection title="Identificación" subtitle="Datos clave para soporte, trazabilidad y debugging.">
                    <Grid container spacing={1.5}>
                      {[
                        { label: 'HG ID', value: detailDialog.hg_id, copyable: true, mono: true },
                        { label: 'Gateway Event ID', value: detailDialog.gateway_event_id, copyable: true, mono: true },
                        { label: 'Provider Event ID', value: detailDialog.provider_event_id, copyable: true, mono: true },
                        { label: 'External ID', value: detailDialog.external_id, copyable: true, mono: true },
                        { label: 'COELSA', value: detailDialog.coelsa_code, copyable: true, mono: true },
                        { label: 'Estado HG', value: detailDialog.status },
                      ].map(field => (
                        <Grid item xs={12} sm={6} key={field.label}>
                          <DetailField {...field} onCopy={copyToClipboard} />
                        </Grid>
                      ))}
                    </Grid>
                  </DetailSection>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <DetailSection title="Resolución" subtitle="Cómo se resolvió y por qué, si quedó en estado pendiente.">
                    <Grid container spacing={1.5}>
                      {[
                        { label: 'Estado resolución', value: RESOLUTION_STATUS_LABELS[detailDialog.resolution_status] || detailDialog.resolution_status },
                        { label: 'Método resolución', value: RESOLUTION_METHOD_LABELS[detailDialog.resolution_method] || detailDialog.resolution_method },
                        { label: 'Account ID recibido', value: detailDialog.account_id, copyable: true, mono: true },
                        { label: 'Cuenta HG', value: detailDialog.account_name, copyable: true },
                        { label: 'Dominio resuelto', value: detailDialog.domain_name, copyable: true },
                        { label: 'Razón no resuelto', value: detailDialog.unresolved_reason },
                      ].map(field => (
                        <Grid item xs={12} sm={6} key={field.label}>
                          <DetailField {...field} onCopy={copyToClipboard} />
                        </Grid>
                      ))}
                    </Grid>
                  </DetailSection>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <DetailSection title="Origen" subtitle="Información del emisor o cuenta origen.">
                    <Grid container spacing={1.5}>
                      {[
                        { label: 'Nombre', value: detailDialog.from_name },
                        { label: 'CUIT', value: detailDialog.from_cuit, copyable: true, mono: true },
                        { label: 'CBU', value: detailDialog.from_cbu, copyable: true, mono: true },
                      ].map(field => (
                        <Grid item xs={12} sm={4} key={field.label}>
                          <DetailField {...field} onCopy={copyToClipboard} />
                        </Grid>
                      ))}
                    </Grid>
                  </DetailSection>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <DetailSection title="Destino" subtitle="Datos de la contraparte o cuenta destino.">
                    <Grid container spacing={1.5}>
                      {[
                        { label: 'Nombre', value: detailDialog.to_name },
                        { label: 'CUIT', value: detailDialog.to_cuit, copyable: true, mono: true },
                        { label: 'CBU', value: detailDialog.to_cbu, copyable: true, mono: true },
                      ].map(field => (
                        <Grid item xs={12} sm={4} key={field.label}>
                          <DetailField {...field} onCopy={copyToClipboard} />
                        </Grid>
                      ))}
                    </Grid>
                  </DetailSection>
                </Grid>

                <Grid item xs={12}>
                  <DetailSection title="Tiempos y flujo" subtitle="Cuándo ingresó y cuándo se reenviaron los datos.">
                    <Grid container spacing={1.5}>
                      {[
                        { label: 'Dirección', value: detailDialog.direction },
                        { label: 'Recibido', value: formatDate(detailDialog.received_at) },
                        { label: 'Reenviado', value: formatDate(detailDialog.forwarded_to_domain_at) },
                        { label: 'Moneda', value: detailDialog.currency },
                      ].map(field => (
                        <Grid item xs={12} sm={6} md={3} key={field.label}>
                          <DetailField {...field} onCopy={copyToClipboard} />
                        </Grid>
                      ))}
                    </Grid>
                  </DetailSection>
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
        <DialogActions sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, bgcolor: 'rgba(2,6,23,0.8)' }}>
          <Button onClick={() => setDetailDialog(null)} variant="outlined">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
      {/* JSON Dialog */}
      <Dialog open={!!jsonDialog} onClose={() => setJsonDialog(null)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>Payload Raw (JSON)</DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{
            bgcolor: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 2, p: 2,
            fontSize: { xs: 11, sm: 12 }, overflow: 'auto',
            maxHeight: { xs: 'calc(100vh - 200px)', sm: 500 },
            fontFamily: 'monospace', m: 0,
            color: '#a5b4fc',
          }}>
            {jsonDialog ? JSON.stringify(jsonDialog.raw_payload, null, 2) : ''}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJsonDialog(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Deliveries Dialog */}
      <Dialog open={!!deliveriesDialog} onClose={() => { setDeliveriesDialog(null); setDeliveries([]); }}
        maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>Historial de Entregas</DialogTitle>
        <DialogContent dividers>
          {deliveries.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>Sin entregas registradas</Typography>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 500 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Estado</TableCell>
                    <TableCell>Intentos</TableCell>
                    <TableCell>HTTP</TableCell>
                    <TableCell>Error</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Acc.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveries.map(d => (
                    <TableRow key={d.id}>
                      <TableCell><StatusChip status={d.status} /></TableCell>
                      <TableCell>{d.attempts}</TableCell>
                      <TableCell>{d.last_http_status || 'â€”'}</TableCell>
                      <TableCell sx={{ fontSize: 11, maxWidth: 180 }}>
                        <Typography variant="caption" title={d.last_error}>
                          {d.last_error?.substring(0, 50) || 'â€”'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDate(d.updated_at)}</TableCell>
                      <TableCell>
                        {d.status !== 'success' && (
                          <Tooltip title="Reintentar">
                            <IconButton size="small" onClick={() => handleRetry(d.id)}>
                              <Refresh fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeliveriesDialog(null); setDeliveries([]); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Manual Resolve Dialog */}
      <Dialog open={!!resolveDialog} onClose={() => !resolving && setResolveDialog(null)}
        maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <BuildCircle color="warning" sx={{ fontSize: 20 }} />
            <span>Resolver manualmente</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {resolveDialog && (
            <Box>
              <Box sx={{
                mb: 2.5, p: 1.75,
                bgcolor: 'rgba(239,68,68,0.06)',
                borderRadius: 2,
                border: '1px solid rgba(239,68,68,0.18)',
              }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Movimiento a resolver
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {resolveDialog.hg_id}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Account ID recibido: {resolveDialog.account_id || 'â€”'}
                </Typography>
                {resolveDialog.unresolved_reason && (
                  <Typography variant="caption" color="error" display="block" sx={{ mt: 0.75 }}>
                    {resolveDialog.unresolved_reason}
                  </Typography>
                )}
              </Box>
              <Autocomplete
                options={accounts}
                getOptionLabel={a => `${a.name} â€” ${a.account_id} (${a.domain_name || 'sin dominio'})`}
                value={selectedAccount}
                onChange={(_, v) => setSelectedAccount(v)}
                renderInput={params => (
                  <TextField {...params} label="Cuenta HG.Cash destino" size="small" fullWidth />
                )}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialog(null)} disabled={resolving}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleResolve} disabled={resolving || !selectedAccount}>
            {resolving ? 'Resolviendo...' : 'Confirmar y reenviar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
