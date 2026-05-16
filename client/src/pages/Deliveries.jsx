import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, IconButton, Tooltip, FormControl, InputLabel,
  Select, MenuItem, Grid, Button, Skeleton, CardContent, useMediaQuery, useTheme,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
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

  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Entregas</Typography>

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
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs="auto">
              <Button
                variant="outlined"
                onClick={() => { setStatusFilter(''); setPage(0); }}
                size="small"
              >
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
                <TableCell sx={hideMd}>Último Error</TableCell>
                <TableCell sx={hideSm}>Actualizado</TableCell>
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
                    Sin entregas
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell><StatusChip status={row.status} /></TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>{row.domain_name || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', ...hideMd }}>
                    {row.hg_id?.substring(0, 12) || '—'}…
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', ...hideSm }}>
                    {formatAmount(row.amount)}
                  </TableCell>
                  <TableCell>{row.attempts}</TableCell>
                  <TableCell sx={hideSm}>{row.last_http_status || '—'}</TableCell>
                  <TableCell sx={{ fontSize: 11, maxWidth: 200, ...hideMd }}>
                    <Typography variant="caption" title={row.last_error}>
                      {row.last_error?.substring(0, 60) || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap', ...hideSm }}>
                    {formatDate(row.updated_at)}
                  </TableCell>
                  <TableCell align="right">
                    {row.status !== 'success' && (
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
