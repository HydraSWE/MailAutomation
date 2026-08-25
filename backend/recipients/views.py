import logging

from datetime import datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django.conf import settings
from common.permissions import RolePermission
from common.tenancy import TenantViewSetMixin, request_organization
from .exporter import export_csv
from .importer import import_recipients
from .models import Recipient, RecipientList
from .serializers import RecipientListSerializer, RecipientSerializer


logger = logging.getLogger(__name__)


def authenticate_lead_hunter_request(request):
    """
    Returns (user, organization) if authenticated and authorized for Lead Hunter.
    Rules:
      1. If email is not a registered, active User -> STRICT REJECT (None, None).
      2. Superuser and Staff accounts -> ALWAYS ALLOWED.
      3. Regular accounts -> Strictly requires:
         a) Role is 'owner' or 'admin' (non-admin members like manager/operator/viewer are blocked).
         b) Organization has an active paid subscription (status == 'active', not is_free, not expired).
    """
    from users.models import User
    from common.models import Organization
    from django.utils import timezone

    def get_or_default_org(u):
        if not u:
            return None
        return getattr(u, "organization", None)

    def is_lead_hunter_authorized(u, org):
        if not u or not u.is_active:
            return False
        # Super admin or system staff always authorized
        if getattr(u, "is_superuser", False) or getattr(u, "is_staff", False):
            return True

        # Strictly limit access to Organization Owner and Admin roles only
        user_role = getattr(u, "role", "")
        if user_role not in ("owner", "admin"):
            return False

        if not org:
            return False

        # Require active paid subscription
        sub = getattr(org, "subscription", None)
        if sub and getattr(sub, "status", "") == "active":
            end_date = getattr(sub, "current_period_end", None)
            if not end_date or end_date >= timezone.now():
                plan = getattr(sub, "plan", None)
                if plan and not getattr(plan, "is_free", False):
                    return True
        return False

    secret = getattr(settings, "MAIL_FLOW_LEADHUNT_RELAY_SECRET", getattr(settings, "MAIL_FLOW_OTP_RELAY_SECRET", "10hyNlU7V0vvt67/T+7HFAtl90y1Q5AYMN4S8QkmpI8="))
    provided_secret = request.headers.get("X-Mail-Flow-Secret") or request.META.get("HTTP_X_MAIL_FLOW_SECRET", "")

    email = (request.data.get("email") or request.query_params.get("email") or "").strip().lower()

    if secret and provided_secret and secret == provided_secret:
        if email:
            user = User.objects.filter(email__iexact=email, is_active=True).first() or User.objects.filter(username__iexact=email, is_active=True).first()
            if user:
                org = get_or_default_org(user)
                if is_lead_hunter_authorized(user, org):
                    return user, org
        return None, None

    if request.user and request.user.is_authenticated:
        try:
            org = request_organization(request, required=False)
        except Exception:
            org = None
        if not org:
            org = get_or_default_org(request.user)
        if is_lead_hunter_authorized(request.user, org):
            return request.user, org
        return None, None

    return None, None

    return None, None



class RecipientListViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    queryset = RecipientList.objects.all().order_by("-created_at")
    serializer_class = RecipientListSerializer
    permission_classes = [RolePermission]
    write_roles = {"admin", "manager"}
    search_fields = ("list_name", "description")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, organization=request_organization(self.request))

    @action(detail=False, methods=["get"], permission_classes=[])
    def summary(self, request):
        user, organization = authenticate_lead_hunter_request(request)
        if not user or not organization:
            return Response({"detail": "Authentication credentials were not provided or invalid."}, status=401)

        lists = RecipientList.objects.filter(organization=organization).order_by("-created_at")
        results = [
            {
                "id": rl.id,
                "list_name": rl.list_name,
                "description": rl.description,
                "recipient_count": rl.recipients.count(),
                "created_at": rl.created_at.strftime("%Y-%m-%d %H:%M") if rl.created_at else "",
            }
            for rl in lists
        ]

        # Quota metadata for Lead Hunter
        sub = getattr(organization, "subscription", None)
        plan = getattr(sub, "plan", None) if sub else None
        max_recipients = getattr(plan, "max_recipients", 10000) if plan else 10000
        current_total_recipients = Recipient.objects.filter(organization=organization).count()
        available_slots = max(0, max_recipients - current_total_recipients)

        return Response({
            "ok": True,
            "results": results,
            "quota": {
                "plan_name": getattr(plan, "name", "Pro") if plan else "Pro",
                "plan_status": getattr(sub, "status", "active") if sub else "active",
                "max_recipients": max_recipients,
                "current_recipients": current_total_recipients,
                "available_slots": available_slots,
                "max_batch_limit": min(500, max(50, available_slots)),
            }
        })


class RecipientViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    throttle_scope = None
    queryset = Recipient.objects.select_related("recipient_list").all().order_by("-created_at")
    serializer_class = RecipientSerializer
    permission_classes = [RolePermission]
    write_roles = {"admin", "manager"}
    filterset_fields = ("recipient_list", "status", "company")
    search_fields = ("name", "email", "company", "phone")
    ordering_fields = ("name", "email", "created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        list_param = self.request.query_params.get("list_id") or self.request.query_params.get("recipient_list") or self.request.query_params.get("recipient_list_id")
        if list_param:
            qs = qs.filter(recipient_list_id=list_param)
        if self.request.query_params.get("tag"):
            qs = qs.filter(tags__contains=[self.request.query_params["tag"]])
        return qs

    def perform_create(self, serializer):
        serializer.save(organization=request_organization(self.request))

    @action(detail=False, methods=["post"], throttle_classes=[ScopedRateThrottle], throttle_scope="file_import")
    def import_file(self, request):
        organization = request_organization(request)
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "File upload is required"}, status=400)
        max_bytes = settings.DATA_UPLOAD_MAX_MEMORY_SIZE
        if file_obj.size > max_bytes:
            return Response({"detail": "Import file is too large."}, status=400)
        list_id = request.data.get("recipient_list") or request.data.get("list_id")
        if list_id:
            recipient_list = RecipientList.objects.filter(pk=list_id, organization=organization).first()
            if not recipient_list:
                return Response({"detail": "Recipient list not found."}, status=400)
        else:
            recipient_list, _ = RecipientList.objects.get_or_create(
                organization=organization, list_name="General Contacts",
                defaults={"description": "Default list for imported recipients", "created_by": request.user},
            )
        try:
            return Response(import_recipients(file_obj, recipient_list))
        except (ValueError, UnicodeDecodeError):
            return Response({"detail": "The import file could not be read. Check its format and column values."}, status=400)
        except Exception:
            logger.exception("Unexpected recipient import failure")
            return Response({"detail": "The import could not be completed. Check the file and try again."}, status=400)

    @action(detail=False, methods=["get"])
    def export_file(self, request):
        return export_csv(self.filter_queryset(self.get_queryset()))

    @action(detail=False, methods=["post"])
    def bulk_update(self, request):
        status_val = request.data.get("status", Recipient.Status.ACTIVE)
        if status_val not in Recipient.Status.values:
            return Response(
                {"detail": f"Invalid status '{status_val}'. Valid choices are: {list(Recipient.Status.values)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ids = request.data.get("ids", [])
        if not isinstance(ids, list):
            return Response({"detail": "ids must be a list."}, status=status.HTTP_400_BAD_REQUEST)
        count = self.get_queryset().filter(pk__in=ids).update(status=status_val)
        return Response({"updated": count})

    @action(detail=False, methods=["post"])
    def bulk_delete(self, request):
        count, _ = self.get_queryset().filter(pk__in=request.data.get("ids", [])).delete()
        return Response({"deleted": count})

    @action(detail=False, methods=["post"], permission_classes=[])
    def push_leads(self, request):
        user, organization = authenticate_lead_hunter_request(request)
        if not user or not organization:
            return Response({"detail": "Authentication credentials were not provided or invalid."}, status=401)

        # Quota verification
        sub = getattr(organization, "subscription", None)
        plan = getattr(sub, "plan", None) if sub else None
        max_recipients = getattr(plan, "max_recipients", 10000) if plan else 10000
        current_total_recipients = Recipient.objects.filter(organization=organization).count()
        available_slots = max(0, max_recipients - current_total_recipients)

        if available_slots <= 0:
            plan_title = getattr(plan, "name", "Current") if plan else "Current"
            return Response({
                "ok": False,
                "error": f"Recipient limit reached ({current_total_recipients}/{max_recipients}). Upgrade your {plan_title} plan to import more leads.",
                "quota_exceeded": True,
                "max_recipients": max_recipients,
                "current_recipients": current_total_recipients,
                "available_slots": 0,
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        list_id = data.get("list_id") or data.get("recipient_list")
        list_name = (data.get("list_name") or "").strip()
        list_description = (data.get("list_description") or "Imported from Mail Flow Lead Hunter").strip()
        leads = data.get("leads", [])
        custom_tags = data.get("tags") or []
        if isinstance(custom_tags, str):
            custom_tags = [custom_tags]

        if not leads or not isinstance(leads, list):
            return Response({"detail": "A list of leads is required."}, status=400)

        # Resolve or create recipient list
        recipient_list = None
        if list_id:
            recipient_list = RecipientList.objects.filter(pk=list_id, organization=organization).first()
            if not recipient_list:
                return Response({"detail": f"Recipient list ID {list_id} not found."}, status=404)
        elif list_name:
            recipient_list, _ = RecipientList.objects.get_or_create(
                organization=organization,
                list_name=list_name,
                defaults={"description": list_description, "created_by": user},
            )
        else:
            default_name = f"Lead Hunter - {datetime.now().strftime('%b %d, %Y')}"
            recipient_list, _ = RecipientList.objects.get_or_create(
                organization=organization,
                list_name=default_name,
                defaults={"description": list_description, "created_by": user},
            )

        existing_emails = set(
            Recipient.objects.filter(recipient_list=recipient_list).values_list("email", flat=True)
        )
        existing_emails_lower = {e.strip().lower() for e in existing_emails if e}

        new_recipients = []
        batch_seen_emails = set()
        duplicates_count = 0

        for lead in leads:
            if not isinstance(lead, dict):
                continue

            raw_emails = lead.get("emails") or lead.get("email") or []
            if isinstance(raw_emails, str):
                raw_emails = [e.strip() for e in raw_emails.replace(";", ",").split(",") if e.strip()]
            elif not isinstance(raw_emails, list):
                raw_emails = []

            valid_emails = []
            for em in raw_emails:
                clean_em = str(em).strip().lower()
                if "@" in clean_em and "." in clean_em and len(clean_em) <= 254:
                    valid_emails.append(clean_em)

            if not valid_emails:
                continue

            lead_name = (lead.get("name") or lead.get("username") or "").strip()
            lead_company = (lead.get("company") or lead_name).strip()

            raw_phones = lead.get("phones") or lead.get("phone") or []
            if isinstance(raw_phones, list):
                lead_phone = ", ".join(str(p).strip() for p in raw_phones if p)
            else:
                lead_phone = str(raw_phones).strip()

            lead_website = (lead.get("website") or lead.get("url") or lead.get("profileUrl") or "").strip()
            if lead_website and not (lead_website.startswith("http://") or lead_website.startswith("https://")):
                lead_website = "https://" + lead_website

            source = lead.get("source") or "lead_hunter"
            lead_tags = list(set(custom_tags + ["lead-hunter", str(source).lower().replace(" ", "-")]))
            if lead.get("tags") and isinstance(lead.get("tags"), list):
                lead_tags = list(set(lead_tags + lead.get("tags")))

            metadata = {
                "source": source,
                "address": lead.get("address", ""),
                "rating": lead.get("rating", ""),
                "socials": lead.get("socials", {}),
                "bio": lead.get("bio", ""),
                "avatar_url": lead.get("image", ""),
                "extracted_at": lead.get("extracted_at", datetime.now().isoformat()),
            }

            for email_addr in valid_emails:
                if email_addr in existing_emails_lower or email_addr in batch_seen_emails:
                    duplicates_count += 1
                    continue

                batch_seen_emails.add(email_addr)
                new_recipients.append(
                    Recipient(
                        organization=organization,
                        recipient_list=recipient_list,
                        name=lead_name[:255],
                        email=email_addr,
                        company=lead_company[:255],
                        phone=lead_phone[:50],
                        website=lead_website[:255] if lead_website else None,
                        status=Recipient.Status.ACTIVE,
                        tags=lead_tags,
                        metadata=metadata,
                    )
                )

        quota_warning = None
        if len(new_recipients) > available_slots:
            skipped_due_to_quota = len(new_recipients) - available_slots
            new_recipients = new_recipients[:available_slots]
            quota_warning = f"Imported {available_slots} leads. {skipped_due_to_quota} leads were skipped because your plan's recipient quota was reached."

        if new_recipients:
            Recipient.objects.bulk_create(new_recipients, batch_size=500)

        updated_total_recipients = Recipient.objects.filter(organization=organization).count()
        new_available_slots = max(0, max_recipients - updated_total_recipients)

        return Response({
            "ok": True,
            "list_id": recipient_list.id,
            "list_name": recipient_list.list_name,
            "inserted": len(new_recipients),
            "duplicates": duplicates_count,
            "total_processed": len(leads),
            "total_recipients_in_list": recipient_list.recipients.count(),
            "quota_warning": quota_warning,
            "quota": {
                "max_recipients": max_recipients,
                "current_recipients": updated_total_recipients,
                "available_slots": new_available_slots,
            }
        }, status=status.HTTP_200_OK)


