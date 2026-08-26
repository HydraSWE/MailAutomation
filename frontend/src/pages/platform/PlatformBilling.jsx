import { useEffect, useState } from "react";
import { CheckCircle2, CircleDollarSign, KeyRound, Layers, Loader2, Search, Save, Wallet } from "lucide-react";
import api from "../../services/api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import CustomSelect from "../../components/common/CustomSelect";
import { apiError } from "../../utils/apiError";
import { useAutoDismiss } from "../../hooks/useAutoDismiss";

const NETWORK_OPTIONS = [
  { value: "bsc", label: "BNB Smart Chain (BEP-20 USDT)" },
  { value: "ethereum", label: "Ethereum (ERC-20 USDT)" },
  { value: "tron", label: "Tron (TRC-20 USDT)" },
  { value: "ton", label: "TON (USDT Jetton)" },
];

const NETWORK_PLACEHOLDERS = {
  bsc: "BSC transaction hash (0x...) or BscScan link",
  ethereum: "Ethereum transaction hash (0x...) or Etherscan link",
  tron: "Tron transaction ID (64-character hex) or TronScan link",
  ton: "TON transaction hash or TonViewer / TonScan link",
};

const emptyBilling = {
  usdt_bdt_rate: "",
  payment_evm_wallet: "",
  payment_tron_wallet: "",
  payment_ton_wallet: "",
  tron_api_key: "",
  toncenter_api_key: "",
  clear_tron_api_key: false,
  clear_toncenter_api_key: false,
  tron_api_key_configured: false,
  toncenter_api_key_configured: false,
  addon_email_10k_price: 120,
  addon_admin_price: 150,
  addon_user_price: 20,
  addon_smtp_price: 300,
  addon_recipient_10k_price: 100,
  custom_plan_max_self_serve_price_bdt: 15000,
};

export default function PlatformBilling() {
  const [billing, setBilling] = useState(emptyBilling);
  const [original, setOriginal] = useState(emptyBilling);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [inspectNetwork, setInspectNetwork] = useState("bsc");
  const [inspectHash, setInspectHash] = useState("");
  const [inspectResult, setInspectResult] = useState(null);
  const [message, setMessage] = useAutoDismiss("");
  const [error, setError] = useAutoDismiss("");
  const [confirmWalletSave, setConfirmWalletSave] = useState(false);

  useEffect(() => {
    api.get("/platform/billing-configuration/").then((response) => {
      const value = { ...emptyBilling, ...response.data, tron_api_key: "", toncenter_api_key: "" };
      setBilling(value);
      setOriginal(value);
    }).catch((requestError) => setError(requestError.response?.data?.detail || "Unable to load billing configuration."))
      .finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const walletsChanged = ["payment_evm_wallet", "payment_tron_wallet", "payment_ton_wallet"].some((key) => billing[key] !== original[key]);
    if (walletsChanged) {
      setConfirmWalletSave(true);
      return;
    }
    await persistBillingConfiguration();
  }

  async function persistBillingConfiguration() {
    setSaving(true);
    const payload = {
      usdt_bdt_rate: billing.usdt_bdt_rate,
      payment_evm_wallet: billing.payment_evm_wallet,
      payment_tron_wallet: billing.payment_tron_wallet,
      payment_ton_wallet: billing.payment_ton_wallet,
      addon_email_10k_price: Number(billing.addon_email_10k_price || 120),
      addon_admin_price: Number(billing.addon_admin_price || 150),
      addon_user_price: Number(billing.addon_user_price || 20),
      addon_smtp_price: Number(billing.addon_smtp_price || 300),
      addon_recipient_10k_price: Number(billing.addon_recipient_10k_price || 100),
      custom_plan_max_self_serve_price_bdt: Number(billing.custom_plan_max_self_serve_price_bdt || 15000),
      clear_tron_api_key: billing.clear_tron_api_key,
      clear_toncenter_api_key: billing.clear_toncenter_api_key,
    };
    if (billing.tron_api_key) payload.tron_api_key = billing.tron_api_key;
    if (billing.toncenter_api_key) payload.toncenter_api_key = billing.toncenter_api_key;
    try {
      const response = await api.patch("/platform/billing-configuration/", payload);
      const value = { ...emptyBilling, ...response.data, tron_api_key: "", toncenter_api_key: "" };
      setBilling(value);
      setOriginal(value);
      setMessage("Billing configuration saved.");
    } catch (requestError) {
      setError(apiError(requestError, "Unable to save billing configuration."));
    } finally {
      setSaving(false);
    }
  }

  async function inspectBlockchainTransaction() {
    setChecking(true);
    setMessage("");
    setError("");
    setInspectResult(null);
    try {
      const response = await api.post("/billing/platform/blockchain-transaction-inspect/", {
        network: inspectNetwork,
        transaction: inspectHash,
      });
      setInspectResult(response.data);
    } catch (requestError) {
      const data = requestError.response?.data;
      setInspectResult(data && typeof data === "object" ? data : null);
      setError(data?.reason || data?.detail || `Unable to inspect this ${inspectNetwork.toUpperCase()} transaction.`);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading billing configuration…</div>;

  return (
    <>
      <form onSubmit={save} className="space-y-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Billing & Payments</h2>
            <p className="text-sm text-slate-500 mt-1">
              Control quote conversion, receiving wallets, blockchain access, and custom add-on rates.
            </p>
          </div>
          <button
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-indigo-600 text-sm font-semibold disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {message && <Notice>{message}</Notice>}
        {error && <Notice error>{error}</Notice>}

        <Section
          icon={CircleDollarSign}
          title="Exchange rate"
          description="Used when creating new USDT quotes. Existing invoices retain their original rate."
        >
          <label className="block max-w-sm text-xs text-slate-400">
            USDT to BDT rate
            <input
              className="mt-1 w-full"
              required
              type="number"
              min="0.0001"
              step="0.0001"
              value={billing.usdt_bdt_rate}
              onChange={(event) => setBilling({ ...billing, usdt_bdt_rate: event.target.value })}
            />
          </label>
        </Section>

        <Section
          icon={Layers}
          title="Custom add-on unit prices (BDT)"
          description="Adjust the unit rates used in custom plan calculations and invoice generation."
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-xs text-slate-400">
              Extra 10k emails (৳)
              <input
                className="mt-1 w-full"
                required
                type="number"
                min="1"
                value={billing.addon_email_10k_price}
                onChange={(event) => setBilling({ ...billing, addon_email_10k_price: Number(event.target.value) })}
              />
            </label>
            <label className="text-xs text-slate-400">
              Extra admin seat (৳)
              <input
                className="mt-1 w-full"
                required
                type="number"
                min="1"
                value={billing.addon_admin_price}
                onChange={(event) => setBilling({ ...billing, addon_admin_price: Number(event.target.value) })}
              />
            </label>
            <label className="text-xs text-slate-400">
              Extra user seat (৳)
              <input
                className="mt-1 w-full"
                required
                type="number"
                min="1"
                value={billing.addon_user_price}
                onChange={(event) => setBilling({ ...billing, addon_user_price: Number(event.target.value) })}
              />
            </label>
            <label className="text-xs text-slate-400">
              Extra SMTP / inbox connection (৳)
              <input
                className="mt-1 w-full"
                required
                type="number"
                min="1"
                value={billing.addon_smtp_price}
                onChange={(event) => setBilling({ ...billing, addon_smtp_price: Number(event.target.value) })}
              />
            </label>
            <label className="text-xs text-slate-400">
              Extra 10k recipients storage (৳)
              <input
                className="mt-1 w-full"
                required
                type="number"
                min="1"
                value={billing.addon_recipient_10k_price}
                onChange={(event) => setBilling({ ...billing, addon_recipient_10k_price: Number(event.target.value) })}
              />
            </label>
            <label className="text-xs text-slate-400">
              Max self-serve price ceiling (৳)
              <input
                className="mt-1 w-full"
                required
                type="number"
                min="1000"
                step="500"
                value={billing.custom_plan_max_self_serve_price_bdt}
                onChange={(event) => setBilling({ ...billing, custom_plan_max_self_serve_price_bdt: Number(event.target.value) })}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Custom plans with total calculated prices exceeding the self-serve price ceiling require an enterprise quote submission and admin approval.
          </p>
        </Section>

        <Section
          icon={Wallet}
          title="Receiving wallets"
          description="Each new invoice snapshots its receiving address. Verify every address before saving."
        >
          <div className="space-y-4">
            <WalletField
              network="EVM (BSC / Ethereum)"
              note="BEP-20 / ERC-20 USDT receiving address"
              value={billing.payment_evm_wallet}
              onChange={(value) => setBilling({ ...billing, payment_evm_wallet: value })}
            />
            <WalletField
              network="Tron"
              note="TRC-20 USDT receiving address"
              value={billing.payment_tron_wallet}
              onChange={(value) => setBilling({ ...billing, payment_tron_wallet: value })}
            />
            <WalletField
              network="TON"
              note="USDT Jetton receiving address"
              value={billing.payment_ton_wallet}
              onChange={(value) => setBilling({ ...billing, payment_ton_wallet: value })}
            />
          </div>
        </Section>

        <Section
          icon={KeyRound}
          title="API credentials"
          description="Optional API keys for rate-limited RPC and indexing providers. Keys are stored encrypted."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-xs text-slate-400">
              TronGrid API Key
              <span className="block text-[11px] text-slate-500 mb-1">
                {billing.tron_api_key_configured ? "Configured (leave blank to keep)" : "Not configured"}
              </span>
              <input
                type="password"
                value={billing.tron_api_key}
                onChange={(event) => setBilling({ ...billing, tron_api_key: event.target.value })}
                placeholder="TronGrid API key"
                className="w-full"
              />
            </label>
            <label className="block text-xs text-slate-400">
              TON Center API Key
              <span className="block text-[11px] text-slate-500 mb-1">
                {billing.toncenter_api_key_configured ? "Configured (leave blank to keep)" : "Not configured"}
              </span>
              <input
                type="password"
                value={billing.toncenter_api_key}
                onChange={(event) => setBilling({ ...billing, toncenter_api_key: event.target.value })}
                placeholder="TON Center API key"
                className="w-full"
              />
            </label>
          </div>
        </Section>

        {/* Multi-Network Blockchain Transaction Inspector */}
        <Section
          icon={Search}
          title="Blockchain transaction inspector"
          description="Diagnostic utility. Checks whether a confirmed USDT transfer on any supported network reached the configured platform receiving wallet."
        >
          <div className="space-y-4">
            <div className="grid sm:grid-cols-[220px_1fr_auto] gap-2 items-center">
              <CustomSelect
                value={inspectNetwork}
                onChange={(val) => {
                  setInspectNetwork(val);
                  setInspectResult(null);
                }}
                options={NETWORK_OPTIONS}
              />
              <input
                type="text"
                value={inspectHash}
                onChange={(event) => setInspectHash(event.target.value)}
                placeholder={NETWORK_PLACEHOLDERS[inspectNetwork] || "Transaction hash or explorer link"}
                className="min-w-0 w-full"
              />
              <button
                type="button"
                disabled={checking || !inspectHash.trim()}
                onClick={inspectBlockchainTransaction}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition shrink-0"
              >
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {checking ? "Inspecting…" : "Inspect"}
              </button>
            </div>
            {inspectResult && <BlockchainResult result={inspectResult} />}
          </div>
        </Section>

        {(billing.updated_at || billing.updated_by_email) && (
          <p className="text-xs text-slate-600">
            Last updated {billing.updated_at ? new Date(billing.updated_at).toLocaleString() : ""}
            {billing.updated_by_email ? ` by ${billing.updated_by_email}` : ""}
          </p>
        )}
      </form>
      <ConfirmDialog
        isOpen={confirmWalletSave}
        title="Change receiving wallets"
        message="New invoices will use the new receiving addresses immediately. Existing invoices keep their original wallet snapshots."
        confirmLabel="Save wallet changes"
        isDanger={false}
        loading={saving}
        onCancel={() => setConfirmWalletSave(false)}
        onConfirm={async () => {
          setConfirmWalletSave(false);
          await persistBillingConfiguration();
        }}
      />
    </>
  );
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="border-t border-slate-800 pt-6">
      <div className="grid lg:grid-cols-[240px_1fr] gap-5">
        <div>
          <Icon className="w-5 h-5 text-indigo-300" />
          <h3 className="font-semibold mt-3">{title}</h3>
          <p className="text-xs leading-5 text-slate-500 mt-1">{description}</p>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

function WalletField({ network, note, value, onChange }) {
  return (
    <label className="grid sm:grid-cols-[160px_1fr] gap-2 sm:gap-4 sm:items-center">
      <span>
        <strong className="block text-sm text-slate-200">{network}</strong>
        <small className="text-slate-600">{note}</small>
      </span>
      <input
        type="text"
        className="w-full"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Notice({ children, error }) {
  return (
    <div
      className={`p-3 border rounded-md text-sm ${
        error ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      }`}
    >
      {children}
    </div>
  );
}

function BlockchainResult({ result }) {
  const transfers = result.matching_transfers?.length ? result.matching_transfers : result.transfers || [];
  const networkName = (result.network || "bsc").toUpperCase();
  const tokenLabel = result.token || "USDT";

  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        result.matched_wallet ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-semibold">
          {result.matched_wallet ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-amber-300 shrink-0" />
          )}
          <span>
            {result.matched_wallet
              ? `Transfer reached configured ${networkName} wallet`
              : result.found
              ? `Transaction found on ${networkName}, wallet transfer not matched`
              : `Transaction not found on ${networkName}`}
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300 uppercase tracking-wider">
          {tokenLabel}
        </span>
      </div>

      {result.reason && <p className="mt-2 text-xs text-slate-400">{result.reason}</p>}

      <dl className="mt-3 grid sm:grid-cols-2 gap-x-5 gap-y-2 text-xs text-slate-400">
        <ResultItem label="Network" value={networkName} />
        <ResultItem label="Wallet" value={result.wallet} />
        <ResultItem label="Contract" value={result.contract} />
        <ResultItem label="Status" value={result.status} />
        {result.confirmations !== undefined && result.confirmations !== null && (
          <ResultItem label="Confirmations" value={result.confirmations} />
        )}
        <ResultItem label="Block / Ref" value={result.block_number} />
        <ResultItem
          label="Time"
          value={result.occurred_at ? new Date(result.occurred_at).toLocaleString() : ""}
        />
      </dl>

      {transfers.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Detected Transfers</p>
          {transfers.map((transfer, idx) => (
            <div
              key={`${transfer.log_index || idx}-${transfer.to}`}
              className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3 text-xs space-y-1"
            >
              <div className="flex items-center justify-between font-semibold text-slate-200">
                <span>{transfer.amount} {tokenLabel}</span>
                {transfer.matches_wallet && (
                  <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    MATCHED WALLET
                  </span>
                )}
              </div>
              <div className="break-all text-slate-400 text-[11px]">From: <span className="font-mono text-slate-300">{transfer.from}</span></div>
              <div className="break-all text-slate-400 text-[11px]">To: <span className="font-mono text-slate-300">{transfer.to}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultItem({ label, value }) {
  return value === undefined || value === null || value === "" ? null : (
    <div>
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="break-all text-slate-300 font-mono text-[11px]">{String(value)}</dd>
    </div>
  );
}
