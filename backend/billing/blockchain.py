import base64
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import unquote

import requests
from django.conf import settings

from .configuration import get_runtime_billing_configuration


TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


class VerificationError(Exception):
    pass


@dataclass(frozen=True)
class VerifiedTransfer:
    transaction_hash: str
    transfer_index: int
    amount: Decimal
    amount_raw: int
    block_reference: str
    confirmations: int | None
    occurred_at: datetime
    raw: dict


def extract_transaction_hash(value, network):
    value = unquote((value or "").strip())
    if network in {"bsc", "ethereum"}:
        match = re.search(r"0x[a-fA-F0-9]{64}", value)
        if not match:
            raise VerificationError("Enter a valid 0x transaction hash or explorer link.")
        return match.group(0).lower()
    if network == "tron":
        matches = re.findall(r"(?<![a-fA-F0-9])[a-fA-F0-9]{64}(?![a-fA-F0-9])", value)
        if not matches:
            raise VerificationError("Enter a valid Tron transaction ID or explorer link.")
        return matches[-1].lower()
    candidate = value.rstrip("/").split("/")[-1].split("?")[0]
    if not re.fullmatch(r"[A-Za-z0-9_+\-/=]{43,64}", candidate):
        raise VerificationError("Enter a valid TON transaction hash or explorer link.")
    return candidate


def _rpc(url, method, params):
    if not url:
        raise VerificationError("This network RPC is not configured yet.")
    try:
        response = requests.post(url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=15)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise VerificationError("The blockchain RPC is temporarily unavailable.") from exc
    if payload.get("error"):
        raise VerificationError("The blockchain RPC rejected the transaction lookup.")
    return payload.get("result")


def _typed_occurred_at(value, *, milliseconds=False):
    try:
        timestamp = int(value)
    except (TypeError, ValueError) as exc:
        raise VerificationError("The provider did not return a trustworthy transfer timestamp.") from exc
    if milliseconds or timestamp > 10_000_000_000:
        timestamp = timestamp / 1000
    if timestamp < 0:
        raise VerificationError("The provider returned an invalid transfer timestamp.")
    occurred_at = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    if occurred_at > datetime.now(tz=timezone.utc) + timedelta(minutes=5):
        raise VerificationError("The provider returned an implausibly future transfer timestamp.")
    return occurred_at


def _verify_evm(invoice, tx_hash):
    is_bsc = invoice.network == "bsc"
    rpc_url = settings.BSC_RPC_URL if is_bsc else settings.ETH_RPC_URL
    required_confirmations = settings.PAYMENT_CONFIRMATIONS_BSC if is_bsc else settings.PAYMENT_CONFIRMATIONS_ETHEREUM
    receipt = _rpc(rpc_url, "eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        raise VerificationError("Transaction was not found or is still pending.")
    if int(receipt.get("status", "0x0"), 16) != 1:
        raise VerificationError("The transaction failed on-chain.")
    block_number = int(receipt["blockNumber"], 16)
    latest = int(_rpc(rpc_url, "eth_blockNumber", []), 16)
    confirmations = latest - block_number + 1
    if confirmations < required_confirmations:
        raise VerificationError(f"Waiting for confirmations ({confirmations}/{required_confirmations}).")
    block = _rpc(rpc_url, "eth_getBlockByNumber", [receipt["blockNumber"], False])
    occurred_at = _typed_occurred_at(int(block["timestamp"], 16))
    if occurred_at < invoice.created_at - timedelta(minutes=2):
        raise VerificationError("This transaction predates the invoice.")

    target_contract = invoice.token_contract.lower()
    target_recipient = invoice.receiving_address.lower().removeprefix("0x")
    decimals = 18 if is_bsc else 6
    required_raw = int(invoice.amount_raw or (invoice.amount_usdt * (Decimal(10) ** decimals)))
    matches = []
    for log in receipt.get("logs", []):
        topics = [topic.lower() for topic in log.get("topics", [])]
        if log.get("address", "").lower() != target_contract or len(topics) < 3 or topics[0] != TRANSFER_TOPIC:
            continue
        recipient = topics[2][-40:]
        amount_raw = int(log.get("data", "0x0"), 16)
        if recipient == target_recipient:
            matches.append((int(log.get("logIndex", "0x0"), 16), Decimal(amount_raw) / (Decimal(10) ** decimals)))
    if not matches:
        raise VerificationError("No matching confirmed USDT transfer to the configured wallet was found.")
    index, amount = matches[0]
    amount_raw = int(amount * (Decimal(10) ** decimals))
    return VerifiedTransfer(tx_hash, index, amount, amount_raw, str(block_number), confirmations, occurred_at, {
        "block": block_number, "amount": str(amount), "amount_raw": str(amount_raw),
        "timestamp": int(occurred_at.timestamp()), "contract": invoice.token_contract, "destination": invoice.receiving_address,
    })


def inspect_bsc_wallet_transfer(submitted_hash, wallet=None):
    return inspect_wallet_transfer("bsc", submitted_hash, wallet=wallet)


def inspect_wallet_transfer(network, submitted_hash, wallet=None):
    network = (network or "bsc").lower().strip()
    if network in {"bsc", "ethereum"}:
        return _inspect_evm_transfer(network, submitted_hash, wallet)
    if network == "tron":
        return _inspect_tron_transfer(submitted_hash, wallet)
    if network == "ton":
        return _inspect_ton_transfer(submitted_hash, wallet)
    raise VerificationError(f"Unsupported network '{network}'. Supported networks: BSC, Ethereum, Tron, TON.")


def _inspect_evm_transfer(network, submitted_hash, wallet=None):
    is_bsc = network == "bsc"
    tx_hash = extract_transaction_hash(submitted_hash, network)
    target_contract = (settings.USDT_BSC_CONTRACT if is_bsc else settings.USDT_ETH_CONTRACT).lower()
    decimals = 18 if is_bsc else 6
    token_label = "BSC-USD (BEP-20)" if is_bsc else "USDT (ERC-20)"
    rpc_url = settings.BSC_RPC_URL if is_bsc else settings.ETH_RPC_URL
    target_recipient = (wallet or get_runtime_billing_configuration().payment_evm_wallet).lower().removeprefix("0x")
    receipt = _rpc(rpc_url, "eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        return {
            "found": False,
            "matched_wallet": False,
            "transaction_hash": tx_hash,
            "network": network,
            "token": token_label,
            "reason": f"Transaction was not found by the configured {network.upper()} RPC provider.",
            "wallet": f"0x{target_recipient}",
            "contract": target_contract,
            "transfers": [],
            "matching_transfers": [],
        }
    block_number = int(receipt["blockNumber"], 16)
    latest = int(_rpc(rpc_url, "eth_blockNumber", []), 16)
    block = _rpc(rpc_url, "eth_getBlockByNumber", [receipt["blockNumber"], False])
    occurred_at = _typed_occurred_at(int(block["timestamp"], 16))
    transfers = []
    for log in receipt.get("logs", []):
        topics = [topic.lower() for topic in log.get("topics", [])]
        if len(topics) < 3 or topics[0] != TRANSFER_TOPIC:
            continue
        amount_raw = int(log.get("data", "0x0"), 16)
        recipient = topics[2][-40:]
        contract = log.get("address", "")
        transfers.append({
            "log_index": int(log.get("logIndex", "0x0"), 16),
            "contract": contract,
            "from": f"0x{topics[1][-40:]}",
            "to": f"0x{recipient}",
            "amount": str(Decimal(amount_raw) / (Decimal(10) ** decimals)),
            "amount_raw": str(amount_raw),
            "matches_contract": contract.lower() == target_contract,
            "matches_wallet": recipient == target_recipient,
        })
    matched = [
        transfer for transfer in transfers
        if transfer["matches_contract"] and transfer["matches_wallet"]
    ]
    return {
        "found": True,
        "matched_wallet": bool(matched),
        "transaction_hash": tx_hash,
        "network": network,
        "token": token_label,
        "status": "success" if int(receipt.get("status", "0x0"), 16) == 1 else "failed",
        "block_number": block_number,
        "confirmations": latest - block_number + 1,
        "occurred_at": occurred_at.isoformat(),
        "wallet": f"0x{target_recipient}",
        "contract": target_contract,
        "transfers": transfers,
        "matching_transfers": matched,
        "reason": "" if matched else f"No {token_label} transfer to the configured wallet was found in this transaction.",
    }


def _inspect_tron_transfer(submitted_hash, wallet=None):
    tx_hash = extract_transaction_hash(submitted_hash, "tron")
    target_contract = settings.USDT_TRON_CONTRACT
    target_recipient = wallet or get_runtime_billing_configuration().payment_tron_wallet
    url = f"{settings.TRON_API_URL.rstrip('/')}/v1/accounts/{target_recipient}/transactions/trc20"
    params = {"limit": 200, "contract_address": target_contract}
    try:
        response = requests.get(url, params=params, headers=_tron_headers(), timeout=15)
        response.raise_for_status()
        account_transfers = response.json().get("data", [])
    except Exception:
        account_transfers = []

    matched_item = next((item for item in account_transfers if item.get("transaction_id", "").lower() == tx_hash), None)
    if matched_item:
        token = matched_item.get("token_info", {})
        decimals = int(token.get("decimals", 6))
        amount_raw = int(matched_item.get("value", "0"))
        amount = str(Decimal(amount_raw) / (Decimal(10) ** decimals))
        occurred_at = _typed_occurred_at(matched_item.get("block_timestamp"), milliseconds=True)
        transfers = [{
            "log_index": 0,
            "contract": token.get("address", target_contract),
            "from": matched_item.get("from", ""),
            "to": matched_item.get("to", ""),
            "amount": amount,
            "amount_raw": str(amount_raw),
            "matches_contract": token.get("address") == target_contract,
            "matches_wallet": matched_item.get("to") == target_recipient,
        }]
        return {
            "found": True,
            "matched_wallet": True,
            "transaction_hash": tx_hash,
            "network": "tron",
            "token": "USDT (TRC-20)",
            "status": "success",
            "block_number": matched_item.get("block_timestamp", ""),
            "confirmations": None,
            "occurred_at": occurred_at.isoformat(),
            "wallet": target_recipient,
            "contract": target_contract,
            "transfers": transfers,
            "matching_transfers": transfers,
            "reason": "",
        }

    # Try transaction details from TronGrid
    tx_detail_url = f"{settings.TRON_API_URL.rstrip('/')}/v1/transactions/{tx_hash}"
    try:
        tx_resp = requests.get(tx_detail_url, headers=_tron_headers(), timeout=15)
        tx_data = tx_resp.json().get("data", [])
        tx_obj = tx_data[0] if tx_data else None
    except Exception:
        tx_obj = None

    if not tx_obj:
        return {
            "found": False,
            "matched_wallet": False,
            "transaction_hash": tx_hash,
            "network": "tron",
            "token": "USDT (TRC-20)",
            "reason": "Transaction was not found by TronGrid provider.",
            "wallet": target_recipient,
            "contract": target_contract,
            "transfers": [],
            "matching_transfers": [],
        }

    raw_data = tx_obj.get("raw_data", {})
    timestamp = raw_data.get("timestamp") or 0
    occurred_at = _typed_occurred_at(timestamp, milliseconds=True) if timestamp else datetime.now(tz=timezone.utc)
    return {
        "found": True,
        "matched_wallet": False,
        "transaction_hash": tx_hash,
        "network": "tron",
        "token": "USDT (TRC-20)",
        "status": "success" if tx_obj.get("ret", [{}])[0].get("contractRet") == "SUCCESS" else "failed",
        "block_number": str(tx_obj.get("blockNumber", "")),
        "confirmations": None,
        "occurred_at": occurred_at.isoformat(),
        "wallet": target_recipient,
        "contract": target_contract,
        "transfers": [],
        "matching_transfers": [],
        "reason": "Transaction found on Tron, but no confirmed TRC-20 USDT transfer to the configured receiving address was identified.",
    }


def _inspect_ton_transfer(submitted_hash, wallet=None):
    tx_hash = extract_transaction_hash(submitted_hash, "ton")
    target_contract = settings.USDT_TON_CONTRACT
    target_recipient = wallet or get_runtime_billing_configuration().payment_ton_wallet
    api_key = get_runtime_billing_configuration().toncenter_api_key
    headers = {"X-API-Key": api_key} if api_key else {}
    params = {
        "owner_address": target_recipient,
        "direction": "in",
        "jetton_master": target_contract,
        "limit": 200,
        "sort": "desc",
    }
    try:
        response = requests.get(f"{settings.TONCENTER_API_URL.rstrip('/')}/jetton/transfers", params=params, headers=headers, timeout=15)
        response.raise_for_status()
        transfers_data = response.json().get("jetton_transfers", [])
    except Exception:
        return {
            "found": False,
            "matched_wallet": False,
            "transaction_hash": tx_hash,
            "network": "ton",
            "token": "USDT (Jetton)",
            "reason": "TON Center is temporarily unavailable.",
            "wallet": target_recipient,
            "contract": target_contract,
            "transfers": [],
            "matching_transfers": [],
        }

    wanted = _ton_hash_bytes(tx_hash)
    matched_item = next((item for item in transfers_data if _ton_hash_bytes(item.get("transaction_hash", "")) == wanted), None)
    if not matched_item:
        return {
            "found": False,
            "matched_wallet": False,
            "transaction_hash": tx_hash,
            "network": "ton",
            "token": "USDT (Jetton)",
            "reason": "No matching finalized TON USDT Jetton transfer to the configured wallet was found.",
            "wallet": target_recipient,
            "contract": target_contract,
            "transfers": [],
            "matching_transfers": [],
        }

    amount_raw = int(matched_item.get("amount", "0"))
    amount = str(Decimal(amount_raw) / Decimal(1_000_000))
    occurred_at = _typed_occurred_at(matched_item.get("transaction_now") or matched_item.get("utime"))
    transfers = [{
        "log_index": 0,
        "contract": matched_item.get("jetton_master", target_contract),
        "from": matched_item.get("source", ""),
        "to": matched_item.get("destination", target_recipient),
        "amount": amount,
        "amount_raw": str(amount_raw),
        "matches_contract": _ton_address(matched_item.get("jetton_master")) == _ton_address(target_contract),
        "matches_wallet": _ton_address(matched_item.get("destination")) == _ton_address(target_recipient),
    }]
    return {
        "found": True,
        "matched_wallet": True,
        "transaction_hash": tx_hash,
        "network": "ton",
        "token": "USDT (Jetton)",
        "status": "success" if not matched_item.get("transaction_aborted") else "failed",
        "block_number": str(matched_item.get("transaction_lt", "")),
        "confirmations": None,
        "occurred_at": occurred_at.isoformat(),
        "wallet": target_recipient,
        "contract": target_contract,
        "transfers": transfers,
        "matching_transfers": transfers,
        "reason": "",
    }


def _tron_headers():
    api_key = get_runtime_billing_configuration().tron_api_key
    return {"TRON-PRO-API-KEY": api_key} if api_key else {}


def _verify_tron(invoice, tx_hash):
    params = {
        "only_confirmed": "true",
        "contract_address": invoice.token_contract,
        "min_timestamp": int((invoice.created_at - timedelta(minutes=2)).timestamp() * 1000),
        "limit": 200,
    }
    url = f"{settings.TRON_API_URL.rstrip('/')}/v1/accounts/{invoice.receiving_address}/transactions/trc20"
    try:
        response = requests.get(url, params=params, headers=_tron_headers(), timeout=15)
        response.raise_for_status()
        transfers = response.json().get("data", [])
    except (requests.RequestException, ValueError) as exc:
        raise VerificationError("TronGrid is temporarily unavailable.") from exc
    transfer = next((item for item in transfers if item.get("transaction_id", "").lower() == tx_hash), None)
    if not transfer:
        raise VerificationError("No confirmed matching Tron USDT transfer was found.")
    token = transfer.get("token_info", {})
    if token.get("address") != invoice.token_contract or transfer.get("to") != invoice.receiving_address:
        raise VerificationError("The Tron token contract or recipient does not match this invoice.")
    decimals = int(token.get("decimals", 6))
    amount_raw = int(transfer.get("value", "0"))
    amount = Decimal(amount_raw) / (Decimal(10) ** decimals)
    occurred_at = _typed_occurred_at(transfer.get("block_timestamp"), milliseconds=True)
    return VerifiedTransfer(tx_hash, 0, amount, amount_raw, str(transfer.get("block_timestamp", "")), None, occurred_at, {
        "timestamp": int(occurred_at.timestamp()), "amount": str(amount), "amount_raw": str(amount_raw),
        "contract": invoice.token_contract, "destination": invoice.receiving_address,
    })


def _ton_hash_bytes(value):
    value = value.replace("-", "+").replace("_", "/")
    value += "=" * ((4 - len(value) % 4) % 4)
    try:
        return base64.b64decode(value).hex()
    except ValueError:
        return value.lower()


def _ton_address(value):
    value = (value or "").strip()
    if re.fullmatch(r"-?\d+:[A-Fa-f0-9]{64}", value):
        workchain, account = value.split(":", 1)
        return f"{int(workchain)}:{account.lower()}"
    normalized = value.replace("-", "+").replace("_", "/")
    normalized += "=" * ((4 - len(normalized) % 4) % 4)
    try:
        decoded = base64.b64decode(normalized)
        if len(decoded) != 36:
            return value
        workchain = int.from_bytes(decoded[1:2], "big", signed=True)
        return f"{workchain}:{decoded[2:34].hex()}"
    except ValueError:
        return value


def _verify_ton(invoice, tx_hash):
    params = {
        "owner_address": invoice.receiving_address,
        "direction": "in",
        "jetton_master": invoice.token_contract,
        "start_utime": int((invoice.created_at - timedelta(minutes=2)).timestamp()),
        "limit": 200,
        "sort": "desc",
    }
    api_key = get_runtime_billing_configuration().toncenter_api_key
    headers = {"X-API-Key": api_key} if api_key else {}
    try:
        response = requests.get(f"{settings.TONCENTER_API_URL.rstrip('/')}/jetton/transfers", params=params, headers=headers, timeout=15)
        response.raise_for_status()
        transfers = response.json().get("jetton_transfers", [])
    except (requests.RequestException, ValueError) as exc:
        raise VerificationError("TON Center is temporarily unavailable.") from exc
    wanted = _ton_hash_bytes(tx_hash)
    transfer = next((item for item in transfers if _ton_hash_bytes(item.get("transaction_hash", "")) == wanted), None)
    if not transfer:
        raise VerificationError("No matching finalized TON USDT Jetton transfer was found. Submit the recipient transaction hash.")
    if transfer.get("transaction_aborted"):
        raise VerificationError("The TON transaction was aborted.")
    if _ton_address(transfer.get("jetton_master")) != _ton_address(invoice.token_contract):
        raise VerificationError("The TON Jetton master is not the approved USDT contract.")
    destination = transfer.get("destination")
    if destination and _ton_address(destination) != _ton_address(invoice.receiving_address):
        raise VerificationError("The TON transfer recipient does not match this invoice.")
    amount_raw = int(transfer.get("amount", "0"))
    amount = Decimal(amount_raw) / Decimal(1_000_000)
    occurred_at = _typed_occurred_at(transfer.get("transaction_now") or transfer.get("utime"))
    return VerifiedTransfer(tx_hash, 0, amount, amount_raw, str(transfer.get("transaction_lt", "")), None, occurred_at, {
        "trace_id": transfer.get("trace_id"), "amount": str(amount), "amount_raw": str(amount_raw),
        "timestamp": int(occurred_at.timestamp()),
        "contract": invoice.token_contract, "destination": invoice.receiving_address,
    })


def _verify_evm_native(invoice, tx_hash):
    is_bsc = invoice.network == "bsc"
    rpc_url = settings.BSC_RPC_URL if is_bsc else settings.ETH_RPC_URL
    required_confirmations = settings.PAYMENT_CONFIRMATIONS_BSC if is_bsc else settings.PAYMENT_CONFIRMATIONS_ETHEREUM
    receipt = _rpc(rpc_url, "eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        raise VerificationError("Transaction was not found or is still pending.")
    if int(receipt.get("status", "0x0"), 16) != 1:
        raise VerificationError("The transaction failed on-chain.")
        
    block_number = int(receipt["blockNumber"], 16)
    latest = int(_rpc(rpc_url, "eth_blockNumber", []), 16)
    confirmations = latest - block_number + 1
    if confirmations < required_confirmations:
        raise VerificationError(f"Waiting for confirmations ({confirmations}/{required_confirmations}).")
        
    block = _rpc(rpc_url, "eth_getBlockByNumber", [receipt["blockNumber"], False])
    occurred_at = _typed_occurred_at(int(block["timestamp"], 16))
    if occurred_at < invoice.created_at - timedelta(minutes=2):
        raise VerificationError("This transaction predates the invoice.")

    tx = _rpc(rpc_url, "eth_getTransactionByHash", [tx_hash])
    if not tx:
        raise VerificationError("Transaction details could not be retrieved from RPC.")
        
    to_address = (tx.get("to") or "").lower().removeprefix("0x")
    target_recipient = invoice.receiving_address.lower().removeprefix("0x")
    if to_address != target_recipient:
        raise VerificationError("The recipient address does not match this invoice.")
        
    value_raw = int(tx.get("value", "0x0"), 16)
    required_raw = int(invoice.amount_raw or 0)
    min_acceptable_raw = int(required_raw * 9995 // 10000)
    if value_raw < min_acceptable_raw:
        paid_coin = Decimal(value_raw) / Decimal(10**18)
        expected_coin = Decimal(required_raw) / Decimal(10**18)
        sym = "BNB" if is_bsc else "ETH"
        raise VerificationError(f"Underpaid transaction: received {paid_coin:.6f} {sym}, expected {expected_coin:.6f} {sym}.")

    amount = Decimal(value_raw) / Decimal(10**18)
    return VerifiedTransfer(tx_hash, 0, amount, value_raw, str(block_number), confirmations, occurred_at, {
        "block": block_number, "amount": str(amount), "amount_raw": str(value_raw),
        "timestamp": int(occurred_at.timestamp()), "destination": invoice.receiving_address,
        "token": "BNB (Native)" if is_bsc else "ETH (Native)",
    })


def _verify_tron_native(invoice, tx_hash):
    tx_detail_url = f"{settings.TRON_API_URL.rstrip('/')}/v1/transactions/{tx_hash}"
    try:
        response = requests.get(tx_detail_url, headers=_tron_headers(), timeout=15)
        response.raise_for_status()
        data = response.json().get("data", [])
        tx_obj = data[0] if data else None
    except Exception as exc:
        raise VerificationError("TronGrid is temporarily unavailable.") from exc

    if not tx_obj:
        raise VerificationError("No confirmed matching Tron native TRX transfer was found.")
        
    ret = tx_obj.get("ret", [{}])[0]
    if ret.get("contractRet") != "SUCCESS":
        raise VerificationError("The Tron transaction failed on-chain.")

    raw_data = tx_obj.get("raw_data", {})
    contracts = raw_data.get("contract", [])
    if not contracts or contracts[0].get("type") != "TransferContract":
        raise VerificationError("Transaction is not a direct TRX transfer.")

    param_val = contracts[0].get("parameter", {}).get("value", {})
    amount_sun = int(param_val.get("amount", 0))

    timestamp = raw_data.get("timestamp") or int(tx_obj.get("blockTimeStamp", 0))
    occurred_at = _typed_occurred_at(timestamp, milliseconds=True) if timestamp else datetime.now(tz=timezone.utc)
    if occurred_at < invoice.created_at - timedelta(minutes=2):
        raise VerificationError("This transaction predates the invoice.")

    required_sun = int(invoice.amount_raw or 0)
    min_acceptable = int(required_sun * 9995 // 10000)
    if amount_sun < min_acceptable:
        paid_trx = Decimal(amount_sun) / Decimal(10**6)
        expected_trx = Decimal(required_sun) / Decimal(10**6)
        raise VerificationError(f"Underpaid TRX transaction: received {paid_trx:.3f} TRX, expected {expected_trx:.3f} TRX.")

    amount = Decimal(amount_sun) / Decimal(10**6)
    return VerifiedTransfer(tx_hash, 0, amount, amount_sun, str(tx_obj.get("blockNumber", "")), None, occurred_at, {
        "timestamp": int(occurred_at.timestamp()), "amount": str(amount), "amount_raw": str(amount_sun),
        "destination": invoice.receiving_address, "token": "TRX (Native)",
    })


def _verify_ton_native(invoice, tx_hash):
    params = {
        "account": invoice.receiving_address,
        "limit": 50,
    }
    api_key = get_runtime_billing_configuration().toncenter_api_key
    headers = {"X-API-Key": api_key} if api_key else {}
    try:
        response = requests.get(f"{settings.TONCENTER_API_URL.rstrip('/')}/transactions", params=params, headers=headers, timeout=15)
        response.raise_for_status()
        transactions = response.json()
        if isinstance(transactions, dict):
            transactions = transactions.get("result", [])
    except Exception as exc:
        raise VerificationError("TON Center is temporarily unavailable.") from exc

    wanted = _ton_hash_bytes(tx_hash)
    matched = next((item for item in transactions if _ton_hash_bytes(item.get("hash", "") or item.get("transaction_id", {}).get("hash", "")) == wanted), None)
    if not matched:
        raise VerificationError("No matching finalized Gram (TON) transfer to the configured wallet was found.")

    in_msg = matched.get("in_msg", {})
    amount_nano = int(in_msg.get("value", "0"))
    required_nano = int(invoice.amount_raw or 0)
    min_acceptable = int(required_nano * 9995 // 10000)
    if amount_nano < min_acceptable:
        paid_gram = Decimal(amount_nano) / Decimal(10**9)
        expected_gram = Decimal(required_nano) / Decimal(10**9)
        raise VerificationError(f"Underpaid Gram transfer: received {paid_gram:.4f} GRAM, expected {expected_gram:.4f} GRAM.")

    occurred_at = _typed_occurred_at(matched.get("utime") or matched.get("now", 0))
    amount = Decimal(amount_nano) / Decimal(10**9)
    return VerifiedTransfer(tx_hash, 0, amount, amount_nano, str(matched.get("lt", "")), None, occurred_at, {
        "amount": str(amount), "amount_raw": str(amount_nano),
        "timestamp": int(occurred_at.timestamp()),
        "destination": invoice.receiving_address, "token": "GRAM (Native)",
    })


def verify_invoice_transfer(invoice, submitted_hash):
    if getattr(settings, "PAYMENT_REQUIRE_DUAL_PROVIDER", False):
        raise VerificationError("Automatic activation is disabled until this network has two certified verification providers.")
    tx_hash = extract_transaction_hash(submitted_hash, invoice.network)
    
    if getattr(invoice, "payment_asset", "usdt") == "native":
        if invoice.network in {"bsc", "ethereum"}:
            return _verify_evm_native(invoice, tx_hash)
        if invoice.network == "tron":
            return _verify_tron_native(invoice, tx_hash)
        return _verify_ton_native(invoice, tx_hash)
        
    if invoice.network in {"bsc", "ethereum"}:
        return _verify_evm(invoice, tx_hash)
    if invoice.network == "tron":
        return _verify_tron(invoice, tx_hash)
    return _verify_ton(invoice, tx_hash)
