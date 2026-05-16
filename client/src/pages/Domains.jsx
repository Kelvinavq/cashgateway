import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Grid, Skeleton, Stack,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '', slug: '', base_url: '', destination_webhook_url: '', destination_token: '', is_active: true,
};

export default function Domains() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/domains');
      setRows(data.data);
    } catch {
      toast.error('Error al cargar dominios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setForm(EMPTY); setDialog('create'); };
  const openEdit = (row) => {
    setForm({
      name: row.name, slug: row.slug, base_url: row.base_url,
      destination_webhook_url: row.destination_webhook_url || '',
      destination_token: row.destination_token || '',
      is_active: !!row.is_active,
    });
    setDialog(row);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, is_active: form.is_active ? 1 : 0 };
      if (dialog === 'create') {
        await api.post('/domains', payload);
        toast.success('Dominio creado');
      } else {
        await api.put(`/domains/${dialog.id}`, payload);
        toast.success('Dominio actualizado');
      }
      setDialog(null);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/domains/${deleteConfirm.id}`);
      toast.success('Dominio eliminado');
      setDeleteConfirm(null);
      fetch();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const field = (k) => ({
    value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })),
  });

  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Dominios</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? 'Nuevo' : 'Nuevo Dominio'}
        </Button>
      </Box>

      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={hideSm}>Slug</TableCell>
                <TableCell sx={hideMd}>Base URL</TableCell>
                <TableCell sx={hideSm}>Webhook Destino</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acc.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No hay dominios. Crea el primero.
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 0.5, borderRadius: 0.5, display: { sm: 'none' } }}
                    >
                      {row.slug}
                    </Typography>
                  </TableCell>
                  <TableCell sx={hideSm}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                      {row.slug}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideMd }}>{row.base_url}</TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 200, ...hideSm }}>
                    <Typography variant="caption" noWrap title={row.destination_webhook_url} display="block">
                      {row.destination_webhook_url || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(row)}><Edit sx={{ fontSize: 16 }} /></IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row)}><Delete sx={{ fontSize: 16 }} /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{dialog === 'create' ? 'Nuevo Dominio' : 'Editar Dominio'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nombre" fullWidth size="small" required {...field('name')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Slug"
                fullWidth
                size="small"
                required
                {...field('slug')}
                helperText="Solo minúsculas, números y guiones"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Base URL" fullWidth size="small" required {...field('base_url')} placeholder="https://miapp.com" />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Destination Webhook URL"
                fullWidth
                size="small"
                required
                {...field('destination_webhook_url')}
                placeholder="https://miapp.com/webhooks/hgcash"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Destination Token"
                fullWidth
                size="small"
                {...field('destination_token')}
                helperText="Se envía en el header x-gateway-token al destino"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                label="Dominio activo"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <Typography>¿Eliminar el dominio <strong>{deleteConfirm?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
