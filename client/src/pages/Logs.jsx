import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, FormControl, InputLabel, Select, MenuItem, Grid,
  TextField, Button, Skeleton, Chip, Stack, CardContent, useMediaQuery, useTheme,
} from '@mui/material';
import { Article } from '@mui/icons-material';
import api from '../lib/api';
import toast from 'react-hot-toast';

const LEVEL_COLORS = {
  info:  { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6',  border: 'rgba(59,130,246,0.2)'  },
  warn:  { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b',  border: 'rgba(245,158,11,0.2)'  },
  error: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  border: 'rgba(239,68,68,0.2)'   },
  debug: { bg: 'rgba(100,116,139,0.1)',  color: '#64748b',  border: 'rgba(100,116,139,0.15)' },
};

function LevelChip({ level }) {
  const c = LEVEL_COLORS[level] || LEVEL_COLORS.debug;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        px: '8px', py: '2px', borderRadius: '5px',
        fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em',
        bgcolor: c.bg, color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {level}
    </Box>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' });
}

const EMPTY_FILTERS = { level: '', source: '', event_type: '', date_from: '', date_to: '' };

export default function Logs() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, limit: rowsPerPage };
      if (applied.level)      params.level      = applied.level;
      if (applied.source)     params.source     = applied.source;
      if (applied.event_type) params.event_type = applied.event_type;
      if (applied.date_from)  params.date_from  = applied.date_from;
      if (applied.date_to)    params.date_to    = applied.date_to;
      const { data } = await api.get('/logs', { params });
      setRows(data.data);
      setTotal(data.pagination.total);
    } catch {
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, applied]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const applyFilters = () => { setApplied(filters); setPage(0); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(0); };
  const setF = (k) => (e) => setFilters(p => ({ ...p, [k]: e.target.value }));

  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Logs del Sistema</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Registro de actividad y eventos del gateway
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
            <Grid item xs={12} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Nivel</InputLabel>
                <Select value={filters.level} label="Nivel" onChange={setF('level')}>
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warn">Warn</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="debug">Debug</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                fullWidth size="small" label="Source"
                value={filters.source} onChange={setF('source')}
                placeholder="webhook, delivery..."
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                fullWidth size="small" label="Tipo de Evento"
                value={filters.event_type} onChange={setF('event_type')}
                placeholder="delivery_success..."
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                fullWidth size="small" label="Desde" type="datetime-local"
                value={filters.date_from} onChange={setF('date_from')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                fullWidth size="small" label="Hasta" type="datetime-local"
                value={filters.date_to} onChange={setF('date_to')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm="auto">
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" onClick={applyFilters}>Filtrar</Button>
                <Button variant="outlined" size="small" onClick={clearFilters}>Limpiar</Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 500 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap', ...hideSm }}>Fecha</TableCell>
                <TableCell>Nivel</TableCell>
                <TableCell sx={hideSm}>Source</TableCell>
                <TableCell sx={hideMd}>Evento</TableCell>
                <TableCell>Mensaje</TableCell>
                <TableCell sx={hideMd}>IP</TableCell>
                <TableCell sx={hideMd}>Req. ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Box sx={{
                        width: 52, height: 52, borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2,
                      }}>
                        <Article sx={{ fontSize: 26, color: 'primary.light', opacity: 0.7 }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">
                        Sin logs registrados
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        No hay eventos para los filtros seleccionados
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover sx={row.level === 'error' ? { bgcolor: 'rgba(239,68,68,0.03)' } : {}}>
                  <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap', color: 'text.secondary', ...hideSm }}>
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell><LevelChip level={row.level} /></TableCell>
                  <TableCell sx={{ fontSize: 11, ...hideSm }}>
                    {row.source ? (
                      <Chip label={row.source} size="small" sx={{ fontSize: 10, height: 18 }} />
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, ...hideMd }}>
                    {row.event_type ? (
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.light' }}>
                        {row.event_type}
                      </Typography>
                    ) : '—'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="caption" title={row.message} sx={{ display: 'block' }}>
                      {isMobile ? row.message?.substring(0, 60) : row.message?.substring(0, 120)}
                      {row.message?.length > (isMobile ? 60 : 120) ? '…' : ''}
                    </Typography>
                    {isMobile && row.level && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                        {formatDate(row.created_at)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', ...hideMd }}>
                    {row.ip_address || '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary', ...hideMd }}>
                    {row.request_id ? row.request_id.substring(0, 8) + '…' : '—'}
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
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage={isMobile ? '' : 'Por página:'}
        />
      </Card>
    </Box>
  );
}
