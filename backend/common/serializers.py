from rest_framework import serializers
from .models import Organization, OrganizationUsage
from .quotas import usage_snapshot


class OrganizationSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(source="users.count", read_only=True)
    smtp_count = serializers.IntegerField(source="smtp_accounts.count", read_only=True)
    recipient_count = serializers.IntegerField(source="recipients.count", read_only=True)
    usage = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_usage(self, obj):
        return usage_snapshot(obj)


class OrganizationUsageSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = OrganizationUsage
        fields = "__all__"
        read_only_fields = fields
