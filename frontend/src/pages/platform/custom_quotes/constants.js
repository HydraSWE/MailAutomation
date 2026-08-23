export const QUOTE_STATUS_CONFIG = {
  pending_review: {
    label: "Pending Review",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/30",
  },
  invoiced: {
    label: "Invoiced (72h)",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
  },
  payment_review: {
    label: "Payment Review",
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    border: "border-purple-500/30",
  },
  paid: {
    label: "Paid",
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    border: "border-blue-500/30",
  },
  activation_pending: {
    label: "Activation Pending",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
  },
  activated: {
    label: "Activated",
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    border: "border-emerald-400/40",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-500/10",
    text: "text-red-300",
    border: "border-red-500/30",
  },
  expired: {
    label: "Expired",
    bg: "bg-slate-800",
    text: "text-slate-400",
    border: "border-slate-700",
  },
};

export const SUPPORTED_NETWORKS = [
  { id: "bsc", name: "BNB Smart Chain (BSC - BEP20)", symbol: "BSC", feeNote: "Fast & lowest fees" },
  { id: "tron", name: "TRON (TRC20)", symbol: "TRON", feeNote: "Popular & high speed" },
  { id: "ton", name: "TON (The Open Network)", symbol: "TON", feeNote: "Native wallet support" },
  { id: "ethereum", name: "Ethereum (ERC20)", symbol: "ETH", feeNote: "High security standard" },
];
