import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Grid, Skeleton, Stack,
  Chip, Alert, useMediaQuery, useTheme, Divider,
} from '@mui/material';
import {
  Add, Edit, Delete, Refresh, ContentCopy, Visibility, VisibilityOff, Dns,
  HelpOutlined, ArrowRightAlt, LinkOutlined,
} from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const EMPTY = { name: '', ip_whitelist: '', is_active: true };

/* ── Guide sub-components ─────────────────────────────────────── */

function GuideStep({ n, title, children }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: '0.75rem',
        boxShadow: '0 2px 8px rgba(99,102,241,0.4)', mt: 0.25,
      }}>
        {n}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.87rem', color: 'text.primary', mb: 0.5 }}>
          {title}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function CodeBox({ children }) {
  return (
    <Box sx={{
      bgcolor: 'rgba(0,0,0,0.45)',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: '8px',
      p: 1.5,
      fontFamily: 'monospace',
      fontSize: '0.73rem',
      color: '#a5b4fc',
      whiteSpace: 'pre',
      overflowX: 'auto',
      mt: 0.75,
      lineHeight: 1.7,
    }}>
      {children}
    </Box>
  );
}

function ProvidersGuide({ open, onClose }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : '16px' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={800} fontSize="1.05rem">
          Guía de integración · Proveedores
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Cómo conectar tu sistema como fuente de webhooks al gateway
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>

        {/* Flow banner */}
        <Box sx={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
          mb: 3, p: 1.5, borderRadius: '10px',
          bgcolor: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
        }}>
          {[
            { label: 'Tu Sistema (Proveedor)', color: '#6366f1' },
            null,
            { label: 'HG.Cash Gateway', color: '#8b5cf6' },
            null,
            { label: 'Dominio Destino', color: '#10b981' },
          ].map((item, i) =>
            item === null
              ? <ArrowRightAlt key={i} sx={{ color: 'text.disabled', fontSize: 20 }} />
              : <Chip key={i} label={item.label} size="small" sx={{
                  fontWeight: 700, fontSize: '0.68rem',
                  bgcolor: `${item.color}18`, color: item.color,
                  border: `1px solid ${item.color}30`,
                }} />
          )}
        </Box>

        <GuideStep n="1" title="Crear el proveedor en el panel">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Hacé clic en <strong>"Nuevo Proveedor"</strong>, asignale un nombre descriptivo y guardá.
            Al crearse se genera automáticamente un <strong>token único e irrepetible</strong>.
          </Typography>
        </GuideStep>

        <GuideStep n="2" title="Guardar el token (¡solo se muestra una vez!)">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Inmediatamente después de crear el proveedor, el token aparece en pantalla.
            Copialo y guardalo de forma segura — <strong>no se puede recuperar</strong> luego.
            Si lo perdés, podés regenerarlo con el ícono <Refresh sx={{ fontSize: 12, verticalAlign: 'middle' }} /> en la tabla.
          </Typography>
          <Box sx={{
            mt: 1, p: 1.25, borderRadius: '8px',
            bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
          }}>
            <Typography sx={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>
              ⚠ No cierre ni recargue la página sin copiar el token — es irrecuperable.
            </Typography>
          </Box>
        </GuideStep>

        <GuideStep n="3" title="Configurar el endpoint en tu sistema">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Tu sistema debe enviar los webhooks al gateway incluyendo el token
            <strong> directamente en el path de la URL</strong>:
          </Typography>
          <CodeBox>{`POST https://{gateway-host}/api/provider/hgcash/{TOKEN}
Content-Type: application/json

{
  "amount": 5000,
  "currency": "ARS",
  ... (payload del proveedor)
}`}</CodeBox>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Reemplazá <code style={{ color: '#818cf8' }}>{'{TOKEN}'}</code> con el token del proveedor obtenido en el paso 2.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Endpoint alternativo para actualizaciones de estado:{' '}
            <code style={{ color: '#64748b' }}>/api/provider/hgcash/{'{TOKEN}'}/update</code>
          </Typography>
        </GuideStep>

        <GuideStep n="4" title="Whitelist de IPs (opcional pero recomendado)">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Para mayor seguridad, restringí qué IPs pueden enviar webhooks a este proveedor.
            Si lo dejás vacío, el gateway acepta cualquier IP origen.
          </Typography>
          <CodeBox>{`# Una IP o rango CIDR por línea:
203.0.113.45
10.0.0.0/24
192.168.1.0/28`}</CodeBox>
        </GuideStep>

        <Divider sx={{ my: 2 }} />

        <Box sx={{
          p: 1.5, borderRadius: '10px',
          bgcolor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
        }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', mb: 0.5 }}>
            ✓ Una vez configurado
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.6 }}>
            El gateway recibirá los webhooks de tu sistema, los procesará, los registrará como
            movimientos y los reenviará automáticamente a los dominios destino configurados.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>Entendido</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Main component ───────────────────────────────────────────── */

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
  const [guideOpen, setGuideOpen] = useState(false);

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
        setNewTokenAlert({ id: data.data.id, token: data.data.token, name: form.name });
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
      const row = rows.find(r => r.id === id);
      setNewTokenAlert({ id, token: data.token, name: row?.name });
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
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Cómo integrar un proveedor paso a paso">
              <Button
                variant="outlined" size={isMobile ? 'small' : 'medium'}
                startIcon={<HelpOutlined />}
                onClick={() => setGuideOpen(true)}
                sx={{
                  borderColor: 'rgba(99,102,241,0.35)', color: 'primary.light',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(99,102,241,0.08)' },
                }}
              >
                {isMobile ? 'Guía' : 'Cómo integrar'}
              </Button>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate} size={isMobile ? 'small' : 'medium'}>
              {isMobile ? 'Nuevo' : 'Nuevo Proveedor'}
            </Button>
          </Stack>
        </Box>
        <Box sx={{
          height: '1px', mt: 1.5,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.55), rgba(139,92,246,0.25) 40%, transparent 75%)',
        }} />
      </Box>

      {/* Token alert — with usage example */}
      {newTokenAlert && (
        <Alert
          severity="success"
          sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
          onClose={() => setNewTokenAlert(null)}
        >
          <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, mb: 0.75 }}>
            Token generado para &quot;{newTokenAlert.name}&quot; — solo visible ahora
          </Typography>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            bgcolor: 'rgba(0,0,0,0.25)', borderRadius: '6px', px: 1.25, py: 0.75, mb: 1.25,
          }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', flex: 1, color: '#6ee7b7' }}>
              {newTokenAlert.token}
            </Typography>
            <IconButton size="small" onClick={() => copy(newTokenAlert.token)} sx={{ flexShrink: 0 }}>
              <ContentCopy sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Box sx={{
            p: 1.25, borderRadius: '6px',
            bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: '#6ee7b7', mb: 0.5 }}>
              Cómo usarlo — incluir el token en la URL:
            </Typography>
            <Typography sx={{ fontSize: '0.71rem', color: '#a7f3d0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              POST https://&#123;gateway-host&#125;/api/provider/hgcash/<strong>{newTokenAlert.token}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.71rem', color: 'text.secondary', mt: 0.5 }}>
              El token va en el path de la URL, no en los headers. Tu sistema lo configura como parte de la URL de destino.
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell sx={hideSm}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <span>Token</span>
                    <Tooltip title="Se envía en el path de la URL: POST /api/provider/hgcash/{TOKEN}">
                      <LinkOutlined sx={{ fontSize: 13, color: 'text.disabled', cursor: 'help' }} />
                    </Tooltip>
                  </Stack>
                </TableCell>
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
                      <Box sx={{ mt: 1.5 }}>
                        <Button size="small" startIcon={<HelpOutlined />} onClick={() => setGuideOpen(true)}
                          sx={{ color: 'primary.light', fontSize: '0.75rem' }}>
                          Ver guía de integración
                        </Button>
                      </Box>
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
                      <Tooltip title={showTokenId === row.id ? 'Ocultar' : 'Ver token'}>
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
                      <Tooltip title="Regenerar token (genera uno nuevo, el anterior deja de funcionar)">
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
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={700} fontSize="1.05rem">
            {dialog === 'create' ? 'Nuevo Proveedor' : `Editar — ${dialog?.name || ''}`}
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>

          {/* Context banner */}
          <Box sx={{
            mb: 2.5, p: 1.5, borderRadius: '10px',
            bgcolor: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.18)',
          }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'primary.light', mb: 0.5 }}>
              ¿Cómo se usa el token del proveedor?
            </Typography>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', lineHeight: 1.7 }}>
              Al guardar se genera un token único. Tu sistema lo incluye <strong>en el path de la URL</strong> al enviar webhooks al gateway:
            </Typography>
            <Box sx={{
              mt: 0.75, px: 1.25, py: 0.75, borderRadius: '6px',
              bgcolor: 'rgba(0,0,0,0.35)', fontFamily: 'monospace',
              fontSize: '0.72rem', color: '#818cf8',
            }}>
              POST /api/provider/hgcash/<Box component="strong" sx={{ color: '#c084fc' }}>{'{TOKEN}'}</Box>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Nombre del proveedor"
                fullWidth size="small" required
                {...field('name')}
                placeholder="ej: MercadoPago, PayWay, Stripe…"
                helperText="Nombre descriptivo para identificar la fuente de webhooks."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="IP Whitelist  (opcional)"
                fullWidth size="small" multiline rows={3}
                {...field('ip_whitelist')}
                placeholder={'203.0.113.45\n10.0.0.0/24\n(una por línea — vacío = cualquier IP)'}
                helperText="IPs o rangos CIDR que pueden enviar webhooks a este proveedor. Vacío = acepta cualquier origen."
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                label={
                  <Box>
                    <Typography variant="body2">Proveedor activo</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Inactivo = los webhooks de este proveedor serán rechazados con 401.
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>

          {dialog === 'create' && (
            <Box sx={{
              mt: 2, p: 1.25, borderRadius: '8px',
              bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
            }}>
              <Typography sx={{ fontSize: '0.77rem', color: '#f59e0b', fontWeight: 600 }}>
                ⚠ Al guardar se mostrará el token una sola vez. No cierre esa ventana sin copiarlo.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setGuideOpen(true)} startIcon={<HelpOutlined />}
            sx={{ mr: 'auto', color: 'text.secondary', fontSize: '0.78rem' }}>
            Ver guía completa
          </Button>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
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

      {/* Integration guide */}
      <ProvidersGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Box>
  );
}
