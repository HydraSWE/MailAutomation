from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
import ipaddress
import socket

url_validator = URLValidator()

def is_valid_url(value: str) -> bool:
    try:
        url_validator(value)
        return True
    except ValidationError:
        return False


def validate_public_hostname(value: str, *, field_name: str = "host") -> str:
    host = str(value or "").strip().rstrip(".").lower()
    if not host or len(host) > 253:
        raise ValidationError({field_name: "Enter a valid public hostname."})
    if host in {"localhost", "localhost.localdomain"}:
        raise ValidationError({field_name: "Localhost targets are not allowed."})
    try:
        ipaddress.ip_address(host)
        raise ValidationError({field_name: "IP address targets are not allowed. Use a public hostname."})
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValidationError({field_name: "Hostname could not be resolved."}) from exc
    addresses = {info[4][0] for info in infos if info and info[4]}
    if not addresses:
        raise ValidationError({field_name: "Hostname has no usable address records."})
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValidationError({field_name: "Private or reserved network targets are not allowed."})
    return host
