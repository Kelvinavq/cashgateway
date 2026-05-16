import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Switch,
  FormControlLabel, Grid, Skeleton, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Edit, Delete, ContentCopy, Check } from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', account_id: '', cuit: '', cbu: '', alias: '',
  domain_id: '', webhook_secret: '', provider_token: '', is_active: true,
};

export default function Accounts() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copied, setCopied] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, domRes] = await Promise.all([api.get('/accounts'), api.get('/domains')]);
      setRows(accRes.data.data);
      setDomains(domRes.data.data);
    } catch {
      toast.error('Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setForm(EMPTY_FORM); setDialog('create'); };
  const openEdit = (row) => {
    setForm({
      name: row.name || '', account_id: row.account_id || '', cuit: row.cuit || '',
      cbu: row.cbu || '', alias: row.alias || '', domain_id: row.domain_id || '',
      webhook_secret: row.webhook_secret || '', provider_token: row.provider_token || '',
      is_active: !!row.is_active,
    });
    setDialog(row);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, domain_id: parseInt(form.domain_id), is_active: form.is_active ? 1 : 0 };
      if (dialog === 'create') {
        await api.post('/accounts', payload);
        toast.success('Cuenta creada');
      } else {
        await api.put(`/accounts/${dialog.id}`, payload);
        toast.success('Cuenta actualizada');
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
      await api.delete(`/accounts/${deleteConfirm.id}`);
      toast.success('Cuenta eliminada');
      setDeleteConfirm(null);
      fetch();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const copyUrl = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success('URL copiada');
  };

  const field = (k) => ({
    value: form[k],
    onChange: (e) => setForm(p => ({ ...p, [k]: e.target.value })),
  });

  const hideSm = { display: { xs: 'none', sm: 'table-cell' } };
  const hideMd = { display: { xs: 'none', md: 'table-cell' } };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Cuentas HG.Cash</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} size={isMobile ? 'small' : 'medium'}>
          {isMobile ? 'Nueva' : 'Nueva Cuenta'}
        </Button>
      </Box>

      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 480 }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={hideSm}>CUIT</TableCell>
                <TableCell sx={hideMd}>CBU</TableCell>
                <TableCell sx={hideSm}>Dominio</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell sx={hideMd}>URL Webhook</TableCell>
                <TableCell align="right">Acc.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No hay cuentas. Crea la primera.
                  </TableCell>
                </TableRow>
              ) : rows.map(row => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: { sm: 'none' } }}>
                      {row.cuit}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>{row.cuit}</TableCell>
                  <TableCell sx={{ fontSize: 11, fontFamily: 'monospace', ...hideMd }}>{row.cbu}</TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideSm }}>{row.domain_name || '—'}</TableCell>
                  <TableCell>
                    <StatusChip status={row.is_active ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell sx={hideMd}>
                    {row.webhook_url && (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: 'monospace', fontSize: 10, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={row.webhook_url}
                        >
                          {row.webhook_url}
                        </Typography>
                        <Tooltip title={copied === row.id ? 'Copiado!' : 'Copiar URL'}>
                          <IconButton size="small" onClick={() => copyUrl(row.webhook_url, row.id)}>
                            {copied === row.id
                              ? <Check sx={{ fontSize: 14, color: 'success.main' }} />
                              : <ContentCopy sx={{ fontSize: 14 }} />}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0} justifyContent="flex-end">
                      {row.webhook_url && (
                        <Tooltip title="Copiar URL" sx={{ display: { md: 'none' } }}>
                          <IconButton size="small" onClick={() => copyUrl(row.webhook_url, row.id)}>
                            {copied === row.id
                              ? <Check sx={{ fontSize: 16, color: 'success.main' }} />
                              : <ContentCopy sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                      )}
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
        <DialogTitle>{dialog === 'create' ? 'Nueva Cuenta HG.Cash' : 'Editar Cuenta'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nombre" fullWidth size="small" required {...field('name')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account ID (HG)"
                fullWidth
                size="small"
                required
                {...field('account_id')}
                disabled={dialog !== 'create'}
                helperText={dialog !== 'create' ? 'No editable' : ''}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="CUIT (11 dígitos)" fullWidth size="small" required {...field('cuit')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="CBU (22 dígitos)" fullWidth size="small" required {...field('cbu')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Alias (opcional)" fullWidth size="small" {...field('alias')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Dominio</InputLabel>
                <Select
                  value={form.domain_id}
                  label="Dominio"
                  onChange={e => setForm(p => ({ ...p, domain_id: e.target.value }))}
                >
                  {domains.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Webhook Secret (opcional)" fullWidth size="small" {...field('webhook_secret')} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Provider Token (opcional)"
                fullWidth
                size="small"
                {...field('provider_token')}
                helperText="Token que el proveedor envía en x-provider-token"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                label="Cuenta activa"
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
          <Typography>¿Eliminar la cuenta <strong>{deleteConfirm?.name}</strong>? Esta acción no se puede deshacer.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
