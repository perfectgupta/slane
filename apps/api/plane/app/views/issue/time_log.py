# Python imports
import json

# Django imports
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder

# Third Party imports
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action

# Module imports
from .. import BaseViewSet
from plane.app.serializers import TimeLogSerializer
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import TimeLog
from plane.bgtasks.issue_activities_task import issue_activity
from plane.utils.host import base_host


class TimeLogViewSet(BaseViewSet):
    permission_classes = [ProjectEntityPermission]

    model = TimeLog
    serializer_class = TimeLogSerializer

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .order_by("-created_at")
            .distinct()
        )

    def create(self, request, slug, project_id, issue_id):
        # Match the Plane pattern, passing context explicitly
        serializer = TimeLogSerializer(
            data=request.data, context={"project_id": project_id, "request": request}
        )

        if serializer.is_valid():
            serializer.save(project_id=project_id, issue_id=issue_id)

            issue_activity.delay(
                type="time_log.activity.created",
                requested_data=json.dumps(serializer.data, cls=DjangoJSONEncoder),
                actor_id=str(self.request.user.id),
                issue_id=str(issue_id),
                project_id=str(project_id),
                current_instance=None,
                epoch=int(timezone.now().timestamp()),
                notification=False,
                origin=base_host(request=request, is_app=True),
            )

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def stop(self, request, slug, project_id, issue_id, pk):
        """
        Custom endpoint strictly to stop a running timer.
        Calculates time_seconds automatically via the model's save() hook.
        """
        try:
            time_log = self.get_queryset().get(pk=pk)
        except TimeLog.DoesNotExist:
            return Response(
                {"error": "Time log not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if time_log.tracking_end_time:
            return Response(
                {"error": "This timer is already stopped."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_instance = json.dumps(
            TimeLogSerializer(time_log).data, cls=DjangoJSONEncoder
        )

        # Stop the timer
        time_log.tracking_end_time = timezone.now()
        time_log.save()

        serializer = TimeLogSerializer(time_log)
        requested_data = json.dumps(serializer.data, cls=DjangoJSONEncoder)

        issue_activity.delay(
            type="time_log.activity.updated",
            requested_data=requested_data,
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=False,
            origin=base_host(request=request, is_app=True),
        )

        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, slug, project_id, issue_id, pk):
        try:
            time_log = self.get_queryset().get(pk=pk)
        except TimeLog.DoesNotExist:
            return Response(
                {"error": "Time log not found"}, status=status.HTTP_404_NOT_FOUND
            )

        requested_data = json.dumps(request.data, cls=DjangoJSONEncoder)
        current_instance = json.dumps(
            TimeLogSerializer(time_log).data, cls=DjangoJSONEncoder
        )

        serializer = TimeLogSerializer(time_log, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()

            issue_activity.delay(
                type="time_log.activity.updated",
                requested_data=requested_data,
                actor_id=str(request.user.id),
                issue_id=str(issue_id),
                project_id=str(project_id),
                current_instance=current_instance,
                epoch=int(timezone.now().timestamp()),
                notification=False,
                origin=base_host(request=request, is_app=True),
            )

            time_log = self.get_queryset().get(id=serializer.data.get("id"))
            serializer = TimeLogSerializer(time_log)

            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, slug, project_id, issue_id, pk):
        try:
            time_log = self.get_queryset().get(pk=pk)
        except TimeLog.DoesNotExist:
            return Response(
                {"error": "Time log not found"}, status=status.HTTP_404_NOT_FOUND
            )

        current_instance = json.dumps(
            TimeLogSerializer(time_log).data, cls=DjangoJSONEncoder
        )

        issue_activity.delay(
            type="time_log.activity.deleted",
            requested_data=json.dumps({"time_log_id": str(pk)}),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=False,
            origin=base_host(request=request, is_app=True),
        )

        time_log.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
