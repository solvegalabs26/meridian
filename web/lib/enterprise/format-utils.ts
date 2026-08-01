export function formatLoanStatus(status: string | null | undefined): string {
  if (!status) return '—'
  switch (status.toLowerCase()) {
    case 'current':     return 'Current'
    case '30dpd':       return '30 DPD'
    case '60dpd':       return '60 DPD'
    case '90dpd':       return '90 DPD'
    case 'default':     return 'Default'
    case 'charged_off': return 'Charged Off'
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}
