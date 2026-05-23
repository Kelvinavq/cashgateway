import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, IconButton, Tooltip, FormControl, InputLabel,
  Select, MenuItem, Grid, Button, Skeleton, CardContent, useMediaQuery, useTheme,
  Stack,
} from '@mui/material';
import { Refresh, RestoreFromTrash, CheckCircleOutlined, CancelOutlined, Send } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatAmount(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}

export default function Deliveries() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: rowsPerPage };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/deliveries', { params });
      setRows(data.data);
      setTotal(data.pagination.total);
    } catch {
      toast.error('Error al cargar entregas');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);
  useSocket({ 'delivery:updated': fetchDeliveries });

  const handleRetry = async (id) => {
    try {
      await api.post(`/deliveries/${id}/retry`);
      toast.success('Reintento encolado');
      fetchDeliveries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al reintentar');
    }
  };

  const handleReactivate = async (id) => {
    try {
      await api.post(`/deliveries/${id}/reactivate`);
      toast.success('Entrega reactivada');
      fetchDeliveries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al reactivar');
    }
  };

  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Entregas</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Estado de entregas de webhooks a dominios destino
        </Typography>
        <Box sx={{
          height: '1px', mt: 1.5,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.55), rgba(139,92,246,0.25) 40%, transparent 75%)',
        }} />
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Estado</InputLabel>
                <Select
                  value={statusFilter}
                  label="Estado"
                  onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="pending">Pendiente</MenuItem>
                  <MenuItem value="processing">Procesando</MenuItem>
                  <MenuItem value="success">Exitoso</MenuItem>
                  <MenuItem value="failed">Fallido</MenuItem>
                  <MenuItem value="dead">Dead Letter</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs="auto">
              <Button variant="outlined" onClick={() => { setStatusFilter(''); setPage(0); }} size="small">
                Limpiar
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
                <TableCell>Estado</TableCell>
                <TableCell sx={hideSm}>Dominio</TableCell>
                <TableCell sx={hideMd}>Movimiento</TableCell>
                <TableCell sx={hideSm}>Monto</TableCell>
                <TableCell>Intentos</TableCell>
                <TableCell sx={hideSm}>HTTP</TableCell>
                <TableCell sx={hideMd}>ACK</TableCell>
                <TableCell sx={hideMd}>Último Error</TableCell>
                <TableCell sx={hideSm}>Actualizado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(10)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Box sx={{
                        width: 52, height: 52, borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2,
                      }}>
                        <Send sx={{ fontSize: 24, color: 'primary.light', opacity: 0.7 }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">Sin entregas</Typography>
                      <Typography variant="caption" color="text.disabled">
                        No hay entregas para el filtro seleccionado
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover sx={row.status === 'dead' ? { bgcolor: 'rgba(71,85,105,0.05)' } : {}}>
                  <TableCell><StatusChip status={row.status} /></TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>
                    <Stack spacing={0.25}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {row.domain_hostname || '—'}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {row.domain_name || '—'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', ...hideMd }}>
                    {row.hg_id?.substring(0, 12) || '—'}…
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', ...hideSm }}>
                    {formatAmount(row.amount)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{row.attempts}</TableCell>
                  <TableCell sx={hideSm}>{row.last_http_status || '—'}</TableCell>
                  <TableCell sx={hideMd}>
                    {row.ack_received ? (
                      row.ack_valid ? (
                        <Tooltip title="ACK válido">
                          <CheckCircleOutlined sx={{ fontSize: 16, color: '#10b981' }} />
                        </Tooltip>
                      ) : (
                        <Tooltip title="ACK inválido">
                          <CancelOutlined sx={{ fontSize: 16, color: '#ef4444' }} />
                        </Tooltip>
                      )
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, maxWidth: 200, ...hideMd }}>
                    <Typography variant="caption" title={row.last_error}>
                      {row.last_error?.substring(0, 60) || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap', color: 'text.secondary', ...hideSm }}>
                    {formatDate(row.updated_at)}
                  </TableCell>
                  <TableCell align="right">
                    {row.status === 'dead' ? (
                      <Tooltip title="Reactivar (reiniciar DLQ)">
                        <IconButton size="small" color="warning" onClick={() => handleReactivate(row.id)}>
                          <RestoreFromTrash fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : row.status !== 'success' && (
                      <Tooltip title="Reintentar entrega">
                        <IconButton size="small" color="primary" onClick={() => handleRetry(row.id)}>
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
    </Box>
  );
}
