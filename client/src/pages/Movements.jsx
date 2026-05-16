import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, TextField,
  Select, MenuItem, FormControl, InputLabel, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, Skeleton, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import { Visibility, Refresh, Code, History } from '@mui/icons-material';
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

export default function Movements() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ direction: '', coelsa_code: '', cuit: '' });
  const [detailDialog, setDetailDialog] = useState(null);
  const [jsonDialog, setJsonDialog] = useState(null);
  const [deliveriesDialog, setDeliveriesDialog] = useState(null);
  const [deliveries, setDeliveries] = useState([]);

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
  useSocket({ 'movement:new': fetchMovements, 'delivery:updated': fetchMovements });

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

  const clearFilters = () => {
    setFilters({ direction: '', coelsa_code: '', cuit: '' });
    setPage(0);
  };

  // Responsive column visibility helpers
  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };

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
                <Select
                  value={filters.direction}
                  label="Dirección"
                  onChange={e => setFilters(p => ({ ...p, direction: e.target.value }))}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="Inbound">Inbound</MenuItem>
                  <MenuItem value="Outbound">Outbound</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <TextField
                size="small"
                label="COELSA Code"
                fullWidth
                value={filters.coelsa_code}
                onChange={e => setFilters(p => ({ ...p, coelsa_code: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                size="small"
                label="CUIT"
                fullWidth
                value={filters.cuit}
                onChange={e => setFilters(p => ({ ...p, cuit: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6} sm={6} md="auto">
              <Button variant="outlined" onClick={clearFilters} size="small" fullWidth={isMobile}>
                Limpiar
              </Button>
            </Grid>
            <Grid item xs={6} sm={6} md="auto">
              <Button
                variant="contained"
                onClick={() => { setPage(0); fetchMovements(); }}
                size="small"
                fullWidth={isMobile}
              >
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
                <TableCell>Dir.</TableCell>
                <TableCell sx={hideMd}>De</TableCell>
                <TableCell sx={hideMd}>Para</TableCell>
                <TableCell sx={hideSm}>COELSA</TableCell>
                <TableCell>Entrega</TableCell>
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
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(row.received_at)}</TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>{row.domain_name || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatAmount(row.amount)}</TableCell>
                  <TableCell><StatusChip status={row.direction} /></TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideMd }}>
                    <Box>{row.from_name?.substring(0, 18) || '—'}</Box>
                    <Typography variant="caption" color="text.secondary">{row.from_cuit}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideMd }}>
                    <Box>{row.to_name?.substring(0, 18) || '—'}</Box>
                    <Typography variant="caption" color="text.secondary">{row.to_cuit}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', ...hideSm }}>
                    {row.coelsa_code?.substring(0, 10) || '—'}
                  </TableCell>
                  <TableCell><StatusChip status={row.delivery_status || 'pending'} /></TableCell>
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
                ['ID HG', detailDialog.hg_id],
                ['External ID', detailDialog.external_id],
                ['Monto', formatAmount(detailDialog.amount)],
                ['Moneda', detailDialog.currency],
                ['Dirección', detailDialog.direction],
                ['Estado', detailDialog.status],
                ['Tipo', detailDialog.type],
                ['De', detailDialog.from_name],
                ['De CUIT', detailDialog.from_cuit],
                ['De CBU', detailDialog.from_cbu],
                ['Para', detailDialog.to_name],
                ['Para CUIT', detailDialog.to_cuit],
                ['Para CBU', detailDialog.to_cbu],
                ['COELSA', detailDialog.coelsa_code],
                ['Dominio', detailDialog.domain_name],
                ['Recibido', formatDate(detailDialog.received_at)],
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
          <Box
            component="pre"
            sx={{
              bgcolor: 'background.default',
              borderRadius: 2,
              p: 2,
              fontSize: { xs: 11, sm: 12 },
              overflow: 'auto',
              maxHeight: { xs: 'calc(100vh - 200px)', sm: 500 },
              fontFamily: 'monospace',
              m: 0,
            }}
          >
            {jsonDialog ? JSON.stringify(jsonDialog.raw_payload, null, 2) : ''}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJsonDialog(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Deliveries Dialog */}
      <Dialog
        open={!!deliveriesDialog}
        onClose={() => { setDeliveriesDialog(null); setDeliveries([]); }}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
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
    </Box>
  );
}
