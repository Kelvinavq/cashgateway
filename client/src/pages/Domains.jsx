import { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Grid, Skeleton, Stack,
  Alert, Divider, Chip, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Add, Edit, Delete, ContentCopy, Refresh, Lock, LockOpen, Language,
  HelpOutlined, ArrowRightAlt, Shield, Key, Webhook,
} from '@mui/icons-material';
import api from '../lib/api';
import StatusChip from '../components/StatusChip';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '', slug: '', base_url: '', destination_webhook_url: '', destination_token: '',
  require_ack: false, is_active: true,
};

/* ── Guide sub-components ─────────────────────────────────────── */

function GuideStep({ n, title, accent = '#6366f1', children }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: '0.75rem',
        boxShadow: `0 2px 8px ${accent}40`, mt: 0.25,
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
      fontSize: '0.72rem',
      color: '#a5b4fc',
      whiteSpace: 'pre',
      overflowX: 'auto',
      mt: 0.75,
      lineHeight: 1.75,
    }}>
      {children}
    </Box>
  );
}

function HeaderRow({ name, value, color = '#6366f1', desc }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'flex-start' }}>
      <Box sx={{
        fontFamily: 'monospace', fontSize: '0.7rem', color, fontWeight: 700,
        bgcolor: `${color}12`, border: `1px solid ${color}25`,
        px: 0.75, py: 0.25, borderRadius: '4px', flexShrink: 0,
        mt: 0.15,
      }}>
        {name}
      </Box>
      <Box>
        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b' }}>
          {value}
        </Typography>
        {desc && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', lineHeight: 1.4 }}>
            {desc}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function DomainsGuide({ open, onClose }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : '16px' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={800} fontSize="1.05rem">
          Guía de integración · Dominios destino
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Cómo configurar tu aplicación para recibir webhooks del gateway
        </Typography>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>

        {/* Flow banner */}
        <Box sx={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
          mb: 3, p: 1.5, borderRadius: '10px',
          bgcolor: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.18)',
        }}>
          {[
            { label: 'Proveedor', color: '#6366f1' },
            null,
            { label: 'HG.Cash Gateway', color: '#8b5cf6' },
            null,
            { label: 'Tu App (Dominio)', color: '#10b981' },
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

        <GuideStep n="1" title="Crear el dominio en el panel" accent="#6366f1">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Completá el nombre, slug y la URL de tu aplicación. El campo más importante es
            la <strong>Destination Webhook URL</strong>: el endpoint de tu app donde el gateway
            hará POST con cada movimiento procesado.
          </Typography>
        </GuideStep>

        <GuideStep n="2" title="Guardar el secreto HMAC (¡solo se muestra una vez!)" accent="#f59e0b">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Al crear el dominio, se genera un <strong>secreto HMAC único</strong>. Se muestra
            una sola vez — copialo inmediatamente y guardalo como variable de entorno en tu app.
            Lo usarás para verificar que los webhooks recibidos son auténticos.
          </Typography>
          <Box sx={{
            mt: 1, p: 1.25, borderRadius: '8px',
            bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
          }}>
            <Typography sx={{ fontSize: '0.77rem', color: '#f59e0b', fontWeight: 600 }}>
              ⚠ No cierre ni recargue la página sin copiar el secreto HMAC — no se puede recuperar.
            </Typography>
          </Box>
        </GuideStep>

        <GuideStep n="3" title="Headers que el gateway envía a tu app" accent="#8b5cf6">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6, mb: 1 }}>
            Cuando el gateway entrega un webhook hace <code style={{ color: '#818cf8' }}>POST</code> a
            tu <strong>Destination Webhook URL</strong> con estos headers:
          </Typography>
          <Box sx={{
            bgcolor: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: '8px', p: 1.5,
          }}>
            <HeaderRow
              name="x-gateway-token"
              value="{destination_token}"
              color="#10b981"
              desc="Lo configurás vos al crear el dominio. Tu app verifica que coincide para autenticar que la llamada viene del gateway."
            />
            <HeaderRow
              name="x-gateway-signature"
              value="sha256={hex}"
              color="#8b5cf6"
              desc="Firma HMAC-SHA256 del payload. Tu app la recalcula con el secreto HMAC y compara para verificar integridad."
            />
            <HeaderRow
              name="x-gateway-timestamp"
              value="{unix_seconds}"
              color="#f59e0b"
              desc="Timestamp Unix incluido en la firma. Útil para protección anti-replay (rechazar requests con timestamp muy viejo)."
            />
            <Divider sx={{ my: 1 }} />
            <HeaderRow name="x-gateway-event-id"    value="{uuid}"  color="#475569" />
            <HeaderRow name="x-hg-movement-id"      value="{id}"    color="#475569" />
            <HeaderRow name="x-provider-event-id"   value="{id}"    color="#475569" />
          </Box>
        </GuideStep>

        <GuideStep n="4" title="Verificar la firma HMAC en tu app" accent="#10b981">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Usá el secreto HMAC para recalcular la firma y compararla con el header
            <code style={{ color: '#818cf8' }}> x-gateway-signature</code>:
          </Typography>
          <CodeBox>{`// Node.js / Express
const crypto = require('crypto');

app.post('/webhooks/hgcash', express.raw({ type: '*/*' }), (req, res) => {
  const timestamp  = req.headers['x-gateway-timestamp'];
  const signature  = req.headers['x-gateway-signature'];
  const token      = req.headers['x-gateway-token'];
  const rawBody    = req.body.toString();

  // 1. Verificar token de autenticación
  if (token !== process.env.HGCASH_GATEWAY_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // 2. Verificar firma HMAC
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.HGCASH_SIGNING_SECRET)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature), Buffer.from(expected)
  )) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // 3. Procesar el webhook
  const data = JSON.parse(rawBody);
  console.log('Movimiento recibido:', data);

  res.status(200).json({ ok: true }); // ACK
});`}</CodeBox>
        </GuideStep>

        <GuideStep n="5" title="Responder con 200 OK (si ACK está activado)" accent="#06b6d4">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            Si habilitás <strong>"Requerir ACK del destino"</strong>, el gateway espera un
            <code style={{ color: '#818cf8' }}> HTTP 200</code> de tu app como confirmación.
            Si tu app no responde o devuelve error, el gateway reintentará la entrega automáticamente.
          </Typography>
        </GuideStep>

        <Divider sx={{ my: 2 }} />

        <Box sx={{
          p: 1.5, borderRadius: '10px',
          bgcolor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
        }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'primary.light', mb: 0.75 }}>
            Resumen de credenciales
          </Typography>
          <Stack spacing={0.75}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#10b981', mt: 0.75, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', lineHeight: 1.5 }}>
                <strong style={{ color: '#10b981' }}>Destination Token</strong> — lo definís vos. El gateway lo manda en
                <code style={{ color: '#818cf8' }}> x-gateway-token</code> para que tu app autentique al gateway. Si lo dejás vacío, se genera automáticamente.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#8b5cf6', mt: 0.75, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', lineHeight: 1.5 }}>
                <strong style={{ color: '#8b5cf6' }}>Secreto HMAC</strong> — lo genera el gateway. Tu app lo guarda y
                lo usa para verificar la firma en <code style={{ color: '#818cf8' }}>x-gateway-signature</code>.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>Entendido</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Section header inside dialog ────────────────────────────── */

function SectionHeader({ icon: Icon, label, color = '#6366f1' }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, mb: 1.25,
      pb: 0.75, borderBottom: '1px solid', borderColor: 'divider',
    }}>
      <Box sx={{
        width: 22, height: 22, borderRadius: '6px',
        background: `${color}18`, border: `1px solid ${color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon sx={{ fontSize: 13, color }} />
      </Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}

/* ── Main component ───────────────────────────────────────────── */

export default function Domains() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [secretAlert, setSecretAlert] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);

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
        if (data.data?.gateway_signing_secret || data.data?.destination_token) {
          setSecretAlert({
            domainName: form.name,
            signingSecret: data.data.gateway_signing_secret,
            destinationToken: data.data.destination_token,
          });
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
      setSecretAlert({ domainName: name, signingSecret: data.gateway_signing_secret });
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
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Dominios</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Configuración de dominios destino para entregas de webhooks
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Cómo configurar tu app para recibir webhooks del gateway">
              <Button
                variant="outlined" size={isMobile ? 'small' : 'medium'}
                startIcon={<HelpOutlined />}
                onClick={() => setGuideOpen(true)}
                sx={{
                  borderColor: 'rgba(16,185,129,0.35)', color: '#10b981',
                  '&:hover': { borderColor: '#10b981', bgcolor: 'rgba(16,185,129,0.08)' },
                }}
              >
                {isMobile ? 'Guía' : 'Cómo integrar'}
              </Button>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate} size={isMobile ? 'small' : 'medium'}>
              {isMobile ? 'Nuevo' : 'Nuevo Dominio'}
            </Button>
          </Stack>
        </Box>
        <Box sx={{
          height: '1px', mt: 1.5,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.55), rgba(139,92,246,0.25) 40%, transparent 75%)',
        }} />
      </Box>

      {/* Gateway credentials alert — with usage instructions */}
      {secretAlert && (
        <Alert
          severity="warning"
          sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
          onClose={() => setSecretAlert(null)}
        >
          <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, mb: 0.75 }}>
            Credenciales generadas para &quot;{secretAlert.domainName}&quot; — copialas ahora
          </Typography>
          {secretAlert.destinationToken && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              bgcolor: 'rgba(0,0,0,0.25)', borderRadius: '6px', px: 1.25, py: 0.75, mb: 1,
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 700, width: 150, flexShrink: 0 }}>
                Destination Token
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', flex: 1, color: '#bbf7d0' }}>
                {secretAlert.destinationToken}
              </Typography>
              <IconButton size="small" onClick={() => copy(secretAlert.destinationToken)} sx={{ flexShrink: 0 }}>
                <ContentCopy sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          )}
          {secretAlert.signingSecret && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              bgcolor: 'rgba(0,0,0,0.25)', borderRadius: '6px', px: 1.25, py: 0.75, mb: 1.25,
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#fde68a', fontWeight: 700, width: 150, flexShrink: 0 }}>
                HMAC Secret
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', flex: 1, color: '#fde68a' }}>
                {secretAlert.signingSecret}
              </Typography>
              <IconButton size="small" onClick={() => copy(secretAlert.signingSecret)} sx={{ flexShrink: 0 }}>
                <ContentCopy sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          )}
          <Box sx={{
            p: 1.25, borderRadius: '6px',
            bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <Typography sx={{ fontSize: '0.73rem', fontWeight: 700, color: '#fbbf24', mb: 0.5 }}>
              En Betchat, guardá estos valores en la cuenta HG Cash FlowHG:
            </Typography>
            <Typography component="pre" sx={{ fontSize: '0.7rem', color: '#fde68a', fontFamily: 'monospace', lineHeight: 1.6, m: 0, whiteSpace: 'pre-wrap' }}>
              {`webhook_secret = destination_token\ngateway_signing_secret = hmac_secret`}
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
                <TableCell sx={hideSm}>Slug</TableCell>
                <TableCell sx={hideMd}>Base URL</TableCell>
                <TableCell sx={hideSm}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <span>Webhook Destino</span>
                    <Tooltip title="URL de tu app donde el gateway enviará POST con cada movimiento">
                      <Webhook sx={{ fontSize: 12, color: 'text.disabled', cursor: 'help' }} />
                    </Tooltip>
                  </Stack>
                </TableCell>
                <TableCell sx={hideMd}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <span>Firma HMAC</span>
                    <Tooltip title="Secreto para verificar autenticidad — header x-gateway-signature">
                      <Shield sx={{ fontSize: 12, color: 'text.disabled', cursor: 'help' }} />
                    </Tooltip>
                  </Stack>
                </TableCell>
                <TableCell sx={hideMd}>ACK</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
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
                  <TableCell colSpan={8}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Box sx={{
                        width: 52, height: 52, borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mx: 'auto', mb: 2,
                      }}>
                        <Language sx={{ fontSize: 26, color: 'primary.light', opacity: 0.7 }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">
                        No hay dominios
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Creá el primer dominio para empezar
                      </Typography>
                      <Box sx={{ mt: 1.5 }}>
                        <Button size="small" startIcon={<HelpOutlined />} onClick={() => setGuideOpen(true)}
                          sx={{ color: '#10b981', fontSize: '0.75rem' }}>
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
                    <Typography variant="caption" sx={{
                      fontFamily: 'monospace', bgcolor: 'action.hover',
                      px: 0.5, borderRadius: 0.5, display: { sm: 'none' },
                    }}>
                      {row.slug}
                    </Typography>
                  </TableCell>
                  <TableCell sx={hideSm}>
                    <Typography variant="caption" sx={{
                      fontFamily: 'monospace',
                      bgcolor: 'rgba(99,102,241,0.08)',
                      color: 'primary.light',
                      px: 1, py: 0.5, borderRadius: 1,
                      border: '1px solid rgba(99,102,241,0.15)',
                    }}>
                      {row.slug}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, ...hideMd }}>{row.base_url}</TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 200, ...hideSm }}>
                    <Typography variant="caption" noWrap title={row.destination_webhook_url} display="block"
                      color="text.secondary">
                      {row.destination_webhook_url || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={hideMd}>
                    {row.gateway_signing_secret ? (
                      <Tooltip title={`Secreto HMAC — enviado en header x-gateway-signature`}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Lock sx={{ fontSize: 13, color: '#10b981' }} />
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                            {row.gateway_signing_secret.substring(0, 8)}…
                          </Typography>
                        </Stack>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Sin firma HMAC configurada">
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
            {dialog === 'create' ? 'Nuevo Dominio' : `Editar — ${dialog?.name || ''}`}
          </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>

          {/* Context banner */}
          <Box sx={{
            mb: 2.5, p: 1.5, borderRadius: '10px',
            bgcolor: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', mb: 0.75 }}>
              Flujo: Gateway → Tu App
            </Typography>
            <Stack spacing={0.6}>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                  El gateway hace <code style={{ color: '#818cf8' }}>POST</code> a tu <strong>Destination URL</strong> al procesar cada movimiento.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#10b981', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                  Incluye <code style={{ color: '#818cf8' }}>x-gateway-token</code> (autenticación) y <code style={{ color: '#818cf8' }}>x-gateway-signature</code> (firma HMAC).
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* ── Identificación ── */}
          <SectionHeader icon={Language} label="Identificación" color="#6366f1" />
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nombre" fullWidth size="small" required {...field('name')}
                helperText="Nombre descriptivo del dominio." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Slug" fullWidth size="small" required {...field('slug')}
                helperText="Solo minúsculas, números y guiones." />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Base URL" fullWidth size="small" required {...field('base_url')}
                placeholder="https://miapp.com"
                helperText="URL raíz de tu aplicación." />
            </Grid>
          </Grid>

          {/* ── Webhook destino ── */}
          <SectionHeader icon={Webhook} label="Webhook Destino" color="#10b981" />
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Destination Webhook URL"
                fullWidth size="small" required
                {...field('destination_webhook_url')}
                placeholder="https://miapp.com/webhooks/hgcash"
                helperText="El gateway hará POST a esta URL con el payload de cada movimiento. Tu app debe escuchar aquí."
                InputProps={{
                  endAdornment: (
                    <Tooltip title="Gateway → POST a esta URL con cada movimiento procesado">
                      <Webhook sx={{ fontSize: 16, color: '#10b981', mr: 0.5, cursor: 'help' }} />
                    </Tooltip>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Destination Token"
                fullWidth size="small"
                {...field('destination_token')}
                placeholder="mi-token-secreto-123"
                helperText={
                  <span>
                    Lo definís vos. El gateway lo envía en el header{' '}
                    <code style={{ color: '#818cf8' }}>x-gateway-token</code>{' '}
                    para que tu app verifique que la llamada viene del gateway. Si lo dejás vacío, se genera automáticamente.
                  </span>
                }
                InputProps={{
                  endAdornment: (
                    <Tooltip title="→ Header x-gateway-token: tu app verifica este valor para autenticar al gateway">
                      <Key sx={{ fontSize: 16, color: '#6366f1', mr: 0.5, cursor: 'help' }} />
                    </Tooltip>
                  ),
                }}
              />
            </Grid>
          </Grid>

          {/* ── HMAC (solo en edición) ── */}
          {dialog !== 'create' && form._signing_secret_masked && (
            <>
              <SectionHeader icon={Shield} label="Firma HMAC — x-gateway-signature" color="#8b5cf6" />
              <Box sx={{
                mb: 2.5, p: 1.25, borderRadius: '8px',
                bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)',
              }}>
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', lineHeight: 1.6, mb: 1 }}>
                  El gateway firma cada payload con este secreto y lo envía en el header
                  <code style={{ color: '#818cf8' }}> x-gateway-signature: sha256=…</code>.
                  Tu app lo usa para verificar que el payload no fue alterado.
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TextField
                    label="Secreto HMAC actual"
                    fullWidth size="small"
                    value={form._signing_secret_masked}
                    InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
                  />
                  <Tooltip title="Copiar secreto">
                    <IconButton size="small" onClick={() => copy(form._signing_secret_masked)}>
                      <ContentCopy sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Regenerar secreto (el anterior dejará de funcionar inmediatamente)">
                    <IconButton size="small" color="warning"
                      onClick={() => handleRegenerateSecret(dialog.id, dialog.name)}>
                      <Refresh sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </>
          )}

          {/* ── Configuración ── */}
          <SectionHeader icon={Shield} label="Configuración" color="#f59e0b" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControlLabel
              control={<Switch checked={form.require_ack} onChange={e => setForm(p => ({ ...p, require_ack: e.target.checked }))} />}
              label={
                <Box>
                  <Typography variant="body2">Requerir ACK del destino</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tu app debe responder HTTP 200 para confirmar la entrega.
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
              label={
                <Box>
                  <Typography variant="body2">Dominio activo</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Inactivo = el gateway no enviará entregas a este dominio.
                  </Typography>
                </Box>
              }
            />
          </Stack>

          {dialog === 'create' && (
            <Box sx={{
              mt: 2, p: 1.25, borderRadius: '8px',
              bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
            }}>
              <Typography sx={{ fontSize: '0.77rem', color: '#f59e0b', fontWeight: 600 }}>
                ⚠ Al guardar se generará el secreto HMAC (solo visible una vez). No cierre esa ventana sin copiarlo.
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
          <Typography>¿Eliminar el dominio <strong>{deleteConfirm?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      {/* Integration guide */}
      <DomainsGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Box>
  );
}
