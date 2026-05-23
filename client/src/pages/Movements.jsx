import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, TextField,
  Select, MenuItem, FormControl, InputLabel, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Skeleton, Stack, Chip, useMediaQuery, useTheme,
  Autocomplete,
} from '@mui/material';
import { Visibility, Refresh, Code, History, BuildCircle, WarningAmber } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

function formatAmount(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '—';
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
  const colorMap = {
    resolved: 'success',
    unresolved: 'error',
    manually_resolved: 'warning',
  };
  return (
    <Chip
      label={RESOLUTION_STATUS_LABELS[status] || status || '—'}
      color={colorMap[status] || 'default'}
      size="small"
      sx={{ fontSize: 11, height: 20 }}
    />
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

  // Manual resolve modal
  const [resolveDialog, setResolveDialog] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [resolving, setResolving] = useState(false);

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

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

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
    if (!selectedAccount) {
      toast.error('Seleccioná una cuenta HG.Cash');
      return;
    }
    setResolving(true);
    try {
      await api.post(`/movements/${resolveDialog.id}/resolve`, {
        hgcash_account_id: selectedAccount.id,
      });
      toast.success('Movimiento resuelto y reenvío encolado');
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
      <Typography variant="h5" fontWeight={700} gutterBottom>Movimientos</Typography>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={6} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Dirección</InputLabel>
                <Select value={filters.direction} label="Dirección"
                  onChange={e => setFilters(p => ({ ...p, direction: e.target.value }))}>
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="Inbound">Inbound</MenuItem>
                  <MenuItem value="Outbound">Outbound</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Resolución</InputLabel>
                <Select value={filters.resolution_status} label="Resolución"
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
                <InputLabel>Método</InputLabel>
                <Select value={filters.resolution_method} label="Método"
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
                <TableCell>Resolución</TableCell>
                <TableCell sx={hideMd}>Método</TableCell>
                <TableCell sx={hideSm}>Entrega</TableCell>
                <TableCell align="right">Acc.</TableCell>
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
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No se encontraron movimientos
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover
                  sx={row.resolution_status === 'unresolved' ? { bgcolor: 'rgba(239,68,68,0.04)' } : {}}>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(row.received_at)}</TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>{row.domain_name || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatAmount(row.amount)}</TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideMd }}><StatusChip status={row.direction} /></TableCell>
                  <TableCell sx={{ fontSize: 11, ...hideLg }}>{row.account_name || '—'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ResolutionChip status={row.resolution_status} />
                      {row.resolution_status === 'unresolved' && (
                        <Tooltip title={row.unresolved_reason || 'Sin razón'}>
                          <WarningAmber sx={{ fontSize: 14, color: 'error.main', cursor: 'help' }} />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, ...hideMd }}>
                    {RESOLUTION_METHOD_LABELS[row.resolution_method] || '—'}
                  </TableCell>
                  <TableCell sx={{ ...hideSm }}>
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
          labelRowsPerPage={isMobile ? '' : 'Por página:'}
        />
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onClose={() => setDetailDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Detalle de Movimiento</DialogTitle>
        <DialogContent dividers>
          {detailDialog && (
            <Grid container spacing={2}>
              {[
                ['Gateway Event ID', detailDialog.gateway_event_id],
                ['Provider Event ID', detailDialog.provider_event_id],
                ['ID HG', detailDialog.hg_id],
                ['External ID', detailDialog.external_id],
                ['Account ID recibido', detailDialog.account_id],
                ['Cuenta HG', detailDialog.account_name],
                ['Dominio resuelto', detailDialog.domain_name],
                ['Estado resolución', RESOLUTION_STATUS_LABELS[detailDialog.resolution_status] || detailDialog.resolution_status],
                ['Método resolución', RESOLUTION_METHOD_LABELS[detailDialog.resolution_method] || detailDialog.resolution_method],
                ['Razón no resuelto', detailDialog.unresolved_reason],
                ['Monto', formatAmount(detailDialog.amount)],
                ['Moneda', detailDialog.currency],
                ['Dirección', detailDialog.direction],
                ['Estado HG', detailDialog.status],
                ['Tipo', detailDialog.type],
                ['De', detailDialog.from_name],
                ['De CUIT', detailDialog.from_cuit],
                ['De CBU', detailDialog.from_cbu],
                ['Para', detailDialog.to_name],
                ['Para CUIT', detailDialog.to_cuit],
                ['Para CBU', detailDialog.to_cbu],
                ['COELSA', detailDialog.coelsa_code],
                ['Recibido', formatDate(detailDialog.received_at)],
                ['Reenviado', formatDate(detailDialog.forwarded_to_domain_at)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-all' }}>{val || '—'}</Typography>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* JSON Dialog */}
      <Dialog open={!!jsonDialog} onClose={() => setJsonDialog(null)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>Payload Raw (JSON)</DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{
            bgcolor: 'background.default', borderRadius: 2, p: 2,
            fontSize: { xs: 11, sm: 12 }, overflow: 'auto',
            maxHeight: { xs: 'calc(100vh - 200px)', sm: 500 },
            fontFamily: 'monospace', m: 0,
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
                      <TableCell>{d.last_http_status || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 11, maxWidth: 180 }}>
                        <Typography variant="caption" title={d.last_error}>
                          {d.last_error?.substring(0, 50) || '—'}
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
            <BuildCircle color="warning" />
            <span>Resolver manualmente</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {resolveDialog && (
            <Box>
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(239,68,68,0.07)', borderRadius: 1, border: '1px solid rgba(239,68,68,0.2)' }}>
                <Typography variant="caption" color="text.secondary" display="block">Movimiento</Typography>
                <Typography variant="body2" fontWeight={600}>{resolveDialog.hg_id}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Account ID recibido: {resolveDialog.account_id || '—'}
                </Typography>
                {resolveDialog.unresolved_reason && (
                  <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                    {resolveDialog.unresolved_reason}
                  </Typography>
                )}
              </Box>
              <Autocomplete
                options={accounts}
                getOptionLabel={a => `${a.name} — ${a.account_id} (${a.domain_name || 'sin dominio'})`}
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
