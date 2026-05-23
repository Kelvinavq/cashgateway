import { Box } from '@mui/material';

const cfg = {
  success:           { label: 'Entregado',       bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  failed:            { label: 'Fallido',          bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  pending:           { label: 'Pendiente',        bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  processing:        { label: 'Procesando',       bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  done:              { label: 'Completado',       bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  Inbound:           { label: 'Entrada',          bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  Outbound:          { label: 'Salida',           bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  active:            { label: 'Activo',           bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  inactive:          { label: 'Inactivo',         bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
  resolved:          { label: 'Resuelto',         bg: 'rgba(20,184,166,0.12)',  color: '#14b8a6' },
  unresolved:        { label: 'No resuelto',      bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  manually_resolved: { label: 'Resuelto manual',  bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6' },
  dead:              { label: 'Dead Letter',       bg: 'rgba(30,41,59,0.15)',    color: '#475569'  },
};

export default function StatusChip({ status }) {
  const c = cfg[status] || { label: status || '—', bg: 'rgba(100,116,139,0.12)', color: '#64748b' };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        px: '8px',
        py: '3px',
        borderRadius: '6px',
        fontSize: '0.688rem',
        fontWeight: 600,
        bgcolor: c.bg,
        color: c.color,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      <Box
        component="span"
        sx={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          bgcolor: 'currentColor',
          flexShrink: 0,
        }}
      />
      {c.label}
    </Box>
  );
}
