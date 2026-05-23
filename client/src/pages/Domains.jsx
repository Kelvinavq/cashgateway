import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Grid, Skeleton, Stack,
  Alert, Divider,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Edit, Delete, ContentCopy, Refresh, Lock, LockOpen } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '', slug: '', base_url: '', destination_webhook_url: '', destination_token: '',
  require_ack: false, is_active: true,
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
  const [secretAlert, setSecretAlert] = useState(null); // { domainName, secret }

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
      require_ack: !!row.require_ack,
      is_active: !!row.is_active,
      _signing_secret_masked: row.gateway_signing_secret || null,
    });
    setDialog(row);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { _signing_secret_masked, ...rest } = form;
      const payload = { ...rest, is_active: form.is_active ? 1 : 0, require_ack: form.require_ack ? 1 : 0 };
      if (dialog === 'create') {
        const { data } = await api.post('/domains', payload);
        if (data.data?.gateway_signing_secret) {
          setSecretAlert({ domainName: form.name, secret: data.data.gateway_signing_secret });
        }
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

  const handleRegenerateSecret = async (id, name) => {
    try {
      const { data } = await api.post(`/domains/${id}/regenerate-signing-secret`);
      setSecretAlert({ domainName: name, secret: data.gateway_signing_secret });
      toast.success('Firma regenerada');
      setDialog(null);
      fetch();
    } catch {
      toast.error('Error al regenerar firma');
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
    value: form[k] ?? '', onChange: e => setForm(p => ({ ...p, [k]: e.target.value })),
  });
  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copiado'); };

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

      {secretAlert && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setSecretAlert(null)}
          action={<Button size="small" onClick={() => copy(secretAlert.secret)}>Copiar</Button>}
        >
          <strong>Firma HMAC para "{secretAlert.domainName}" (solo se muestra una vez):</strong>{' '}
          <code style={{ wordBreak: 'break-all' }}>{secretAlert.secret}</code>
        </Alert>
      )}

      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={hideSm}>Slug</TableCell>
                <TableCell sx={hideMd}>Base URL</TableCell>
                <TableCell sx={hideSm}>Webhook Destino</TableCell>
                <TableCell sx={hideMd}>Firma</TableCell>
                <TableCell sx={hideMd}>ACK</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acc.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
                  <TableCell sx={hideMd}>
                    {row.gateway_signing_secret ? (
                      <Tooltip title={row.gateway_signing_secret}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Lock sx={{ fontSize: 13, color: '#10b981' }} />
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                            {row.gateway_signing_secret.substring(0, 8)}…
                          </Typography>
                        </Stack>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Sin firma HMAC">
                        <LockOpen sx={{ fontSize: 13, color: 'text.disabled' }} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={hideMd}>
                    <StatusChip status={row.require_ack ? 'active' : 'inactive'} />
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

            {dialog !== 'create' && form._signing_secret_masked && (
              <>
                <Grid item xs={12}>
                  <Divider><Typography variant="caption" color="text.secondary">Seguridad HMAC</Typography></Divider>
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TextField
                      label="Firma HMAC (secreto)"
                      fullWidth
                      size="small"
                      value={form._signing_secret_masked}
                      InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
                      helperText="Cabecera x-gateway-signature en cada entrega"
                    />
                    <Tooltip title="Copiar (enmascarado)">
                      <IconButton size="small" onClick={() => copy(form._signing_secret_masked)}>
                        <ContentCopy sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Regenerar secreto">
                      <IconButton size="small" color="warning"
                        onClick={() => handleRegenerateSecret(dialog.id, dialog.name)}>
                        <Refresh sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={<Switch checked={form.require_ack} onChange={e => setForm(p => ({ ...p, require_ack: e.target.checked }))} />}
                  label="Requerir ACK del destino"
                />
                <FormControlLabel
                  control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                  label="Dominio activo"
                />
              </Stack>
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
