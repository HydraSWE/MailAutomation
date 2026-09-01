import inspect
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from .models import Campaign
from .views import CampaignViewSet, _enqueue_campaign_launch


class CampaignLaunchQueueTests(SimpleTestCase):
    def test_running_status_is_a_valid_campaign_state(self):
        self.assertEqual(Campaign.Status.RUNNING, "running")
        launch_source = inspect.getsource(CampaignViewSet._perform_launch)
        self.assertIn("Campaign.Status.RUNNING", launch_source)
        self.assertNotIn("Campaign.Status.SENDING", launch_source)

    def test_launch_rejects_missing_organization_without_server_error(self):
        campaign = SimpleNamespace(organization=None)

        with self.assertRaisesMessage(ValidationError, "Campaign is not assigned to an organization"):
            CampaignViewSet()._validate_launch(campaign)

    @patch("campaigns.views.validate_organization_active")
    def test_launch_rejects_missing_recipient_list_without_server_error(self, validate_active):
        campaign = SimpleNamespace(
            organization=object(),
            status=Campaign.Status.DRAFT,
            recipient_list=None,
        )

        with self.assertRaisesMessage(ValidationError, "A recipient list is required"):
            CampaignViewSet()._validate_launch(campaign)
        validate_active.assert_not_called()

    @patch("campaigns.views.Campaign.objects.filter")
    @patch("campaigns.views.launch_campaign.delay")
    def test_broker_failure_restores_draft_status(self, delay, campaign_filter):
        delay.side_effect = ConnectionError("broker unavailable")

        queued = _enqueue_campaign_launch(42)

        self.assertFalse(queued)
        campaign_filter.assert_called_once_with(pk=42, status=Campaign.Status.QUEUED)
        campaign_filter.return_value.update.assert_called_once_with(status=Campaign.Status.DRAFT)

    @patch("campaigns.views.Campaign.objects.filter")
    @patch("campaigns.views.launch_campaign.delay")
    def test_successful_enqueue_keeps_queued_status(self, delay, campaign_filter):
        queued = _enqueue_campaign_launch(42)

        self.assertTrue(queued)
        delay.assert_called_once_with(42)
        campaign_filter.assert_not_called()
