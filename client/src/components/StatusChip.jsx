import { Box } from '@mui/material';
import { RESOLUTION_STATUS_CONFIG } from '../../../shared/resolutionStatus.mjs';

const cfg = {
  success:           { label: 'Entregado',       bg: 'rgba(16,185,129,0.12)',  color: '#10b981', pulse: false },
  failed:            { label: 'Fallido',          bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', pulse: false },
  pending:           { label: 'Pendiente',        bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', pulse: true  },
  processing:        { label: 'Procesando',       bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6', pulse: true  },
  done:              { label: 'Completado',       bg: 'rgba(16,185,129,0.12)',  color: '#10b981', pulse: false },
  Inbound:           { label: 'Entrada',          bg: 'rgba(16,185,129,0.12)',  color: '#10b981', pulse: false },
  Outbound:          { label: 'Salida',           bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', pulse: false },
  active:            { label: 'Activo',           bg: 'rgba(16,185,129,0.12)',  color: '#10b981', pulse: false },
  inactive:          { label: 'Inactivo',         bg: 'rgba(100,116,139,0.12)', color: '#64748b', pulse: false },
  dead:              { label: 'Dead Letter',       bg: 'rgba(30,41,59,0.25)',    color: '#475569', pulse: false },
  ...RESOLUTION_STATUS_CONFIG,
};

export default function StatusChip({ status }) {
  const c = cfg[status] || { label: status || '—', bg: 'rgba(100,116,139,0.12)', color: '#64748b', pulse: false };
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
        border: `1px solid ${c.color}22`,
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
          ...(c.pulse && {
            animation: 'chipPulse 1.8s ease-in-out infinite',
            '@keyframes chipPulse': {
              '0%,100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.35, transform: 'scale(0.7)' },
            },
          }),
        }}
      />
      {c.label}
    </Box>
  );
}
