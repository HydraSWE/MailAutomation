from django.test import TestCase
from rest_framework.test import APIClient

from common.models import Organization
from users.models import User
from .models import RecipientList


class OwnerOrganizationContextTests(TestCase):
    def setUp(self):
        self.first = Organization.objects.create(name="First tenant")
        self.second = Organization.objects.create(name="Second tenant")
        self.owner = User.objects.create_user(
            username="platform-owner",
            email="owner@example.test",
            password="ValidPass123!",
            role=User.Role.OWNER,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_owner_can_create_list_in_selected_organization(self):
        response = self.client.post(
            "/api/recipient-lists/",
            {"list_name": "Selected tenant list"},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(self.first.pk),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(RecipientList.objects.get().organization, self.first)

    def test_owner_selection_scopes_tenant_list_reads(self):
        RecipientList.objects.create(list_name="First", organization=self.first, created_by=self.owner)
        RecipientList.objects.create(list_name="Second", organization=self.second, created_by=self.owner)

        response = self.client.get(
            "/api/recipient-lists/",
            HTTP_X_ORGANIZATION_ID=str(self.first.pk),
        )

        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual([item["list_name"] for item in results], ["First"])

    def test_owner_write_without_selection_remains_forbidden(self):
        response = self.client.post(
            "/api/recipient-lists/",
            {"list_name": "Ambiguous"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
