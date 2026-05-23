import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Grid, Skeleton, Stack,
  Chip, Alert, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Edit, Delete, Refresh, ContentCopy, Visibility, VisibilityOff, Dns } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const EMPTY = { name: '', ip_whitelist: '', is_active: true };

export default function Providers() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [newTokenAlert, setNewTokenAlert] = useState(null);
  const [showTokenId, setShowTokenId] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/providers');
      setRows(data.data);
    } catch {
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setForm(EMPTY); setDialog('create'); };
  const openEdit = (row) => {
    setForm({
      name: row.name,
      ip_whitelist: Array.isArray(row.ip_whitelist) ? row.ip_whitelist.join('\n') : '',
      is_active: !!row.is_active,
    });
    setDialog(row);
  };

  const parseWhitelist = (raw) =>
    raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!form.name) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        ip_whitelist: form.ip_whitelist ? parseWhitelist(form.ip_whitelist) : [],
        is_active: form.is_active ? 1 : 0,
      };
      if (dialog === 'create') {
        const { data } = await api.post('/providers', payload);
        setNewTokenAlert({ id: data.data.id, token: data.data.token });
        toast.success('Proveedor creado');
      } else {
        await api.put(`/providers/${dialog.id}`, payload);
        toast.success('Proveedor actualizado');
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
      await api.delete(`/providers/${deleteConfirm.id}`);
      toast.success('Proveedor eliminado');
      setDeleteConfirm(null);
      fetch();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleRegenerateToken = async (id) => {
    try {
      const { data } = await api.post(`/providers/${id}/regenerate-token`);
      setNewTokenAlert({ id, token: data.token });
      toast.success('Token regenerado');
    } catch {
      toast.error('Error al regenerar token');
    }
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copiado'); };
  const field = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });
  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Proveedores</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Fuentes de webhooks autorizadas al gateway
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate} size={isMobile ? 'small' : 'medium'}>
            {isMobile ? 'Nuevo' : 'Nuevo Proveedor'}
          </Button>
        </Box>
        <Box sx={{
          height: '1px', mt: 1.5,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.55), rgba(139,92,246,0.25) 40%, transparent 75%)',
        }} />
      </Box>

      {newTokenAlert && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setNewTokenAlert(null)}
          action={<Button size="small" onClick={() => copy(newTokenAlert.token)}>Copiar</Button>}
        >
          <strong>Token generado (solo se muestra una vez):</strong>{' '}
          <code style={{ wordBreak: 'break-all' }}>{newTokenAlert.token}</code>
        </Alert>
      )}

      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={hideSm}>Token</TableCell>
                <TableCell sx={hideSm}>IP Whitelist</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Box sx={{
                        width: 52, height: 52, borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2,
                      }}>
                        <Dns sx={{ fontSize: 26, color: 'primary.light', opacity: 0.7 }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">
                        No hay proveedores
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Creá el primer proveedor para empezar
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                  </TableCell>
                  <TableCell sx={hideSm}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="caption" sx={{
                        fontFamily: 'monospace',
                        bgcolor: 'rgba(99,102,241,0.08)',
                        color: 'primary.light',
                        px: 1, py: 0.5, borderRadius: 1,
                        border: '1px solid rgba(99,102,241,0.15)',
                      }}>
                        {showTokenId === row.id ? row.token : row.token_masked}
                      </Typography>
                      <Tooltip title={showTokenId === row.id ? 'Ocultar' : 'Ver'}>
                        <IconButton size="small" onClick={() => setShowTokenId(showTokenId === row.id ? null : row.id)}>
                          {showTokenId === row.id
                            ? <VisibilityOff sx={{ fontSize: 14 }} />
                            : <Visibility sx={{ fontSize: 14 }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copiar token">
                        <IconButton size="small" onClick={() => copy(row.token)}>
                          <ContentCopy sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell sx={hideSm}>
                    {Array.isArray(row.ip_whitelist) && row.ip_whitelist.length > 0 ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {row.ip_whitelist.slice(0, 3).map(ip => (
                          <Chip key={ip} label={ip} size="small" sx={{ fontSize: 10, height: 18 }} />
                        ))}
                        {row.ip_whitelist.length > 3 && (
                          <Chip label={`+${row.ip_whitelist.length - 3}`} size="small" sx={{ fontSize: 10, height: 18 }} />
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Cualquier IP</Typography>
                    )}
                  </TableCell>
                  <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0} justifyContent="flex-end">
                      <Tooltip title="Regenerar token">
                        <IconButton size="small" color="warning" onClick={() => handleRegenerateToken(row.id)}>
                          <Refresh sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(row)}>
                          <Edit sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(row)}>
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
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
        <DialogTitle>{dialog === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Nombre" fullWidth size="small" required {...field('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="IP Whitelist"
                fullWidth size="small" multiline rows={3}
                {...field('ip_whitelist')}
                placeholder={'192.168.1.0/24\n10.0.0.1\n(una por línea; vacío = cualquier IP)'}
                helperText="IPs o rangos CIDR separados por línea. Vacío = permite cualquier IP."
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                label="Proveedor activo"
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
          <Typography>¿Eliminar el proveedor <strong>{deleteConfirm?.name}</strong>?</Typography>
          <Typography variant="caption" color="text.secondary">
            Los movimientos asociados conservarán su provider_source_id.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
