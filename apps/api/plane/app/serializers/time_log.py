# apps/api/plane/app/serializers/time_log.py
# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from .base import BaseSerializer
from plane.db.models import TimeLog


class TimeLogSerializer(BaseSerializer):
    is_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = TimeLog
        fields = [
            "id",
            "issue_id",
            "project_id",
            "workspace_id",
            "tracking_start_time",
            "tracking_end_time",
            "time_seconds",
            "time_seconds",
            "description",
            "is_running",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "issue_id",
            "project_id",
            "workspace_id",
            "is_running",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        start = attrs.get("tracking_start_time")
        end = attrs.get("tracking_end_time")
        manual_seconds = self.initial_data.get("time_seconds")

        # Access the user making the request
        user = self.context.get("request").user if self.context.get("request") else None

        if end and not start and not self.instance:
            raise serializers.ValidationError(
                "tracking_end_time requires tracking_start_time."
            )

        if not start and not manual_seconds and not self.instance:
            raise serializers.ValidationError(
                "Either tracking_start_time (timer) or time_seconds (manual log) is required."
            )

        # 1. Concurrent Timers Guardrail: Prevent starting a new timer if one is already active
        if start and not end and user:
            active_timer_exists = TimeLog.objects.filter(
                created_by=user,
                tracking_start_time__isnull=False,
                tracking_end_time__isnull=True,
            ).exists()

            if active_timer_exists:
                raise serializers.ValidationError(
                    {
                        "error": "You already have an active timer running. Please stop it before starting a new one."
                    }
                )

        return attrs
