from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0012_billingconfiguration_custom_plan_max_self_serve_price_bdt_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="billingconfiguration",
            name="usd_price_display_enabled",
            field=models.BooleanField(
                default=True,
                help_text="Show the USD equivalent beside canonical BDT prices.",
            ),
        ),
    ]
