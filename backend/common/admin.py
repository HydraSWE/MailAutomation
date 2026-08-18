from django.contrib import admin
from .models import Organization, OrganizationUsage, SystemSetting

admin.site.register(Organization)
admin.site.register(OrganizationUsage)
admin.site.register(SystemSetting)
