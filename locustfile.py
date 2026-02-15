"""
MANJU Backend Load Test (Locust)
================================
Usage:
  locust -f locustfile.py --host http://localhost:8080

Then open http://localhost:8089 to configure users & spawn rate.
"""

from locust import HttpUser, task, between, tag
import json
import uuid


class ManjuUser(HttpUser):
    """Simulates a typical MANJU platform user interacting with the backend API."""

    wait_time = between(1, 3)

    def on_start(self):
        """Create a test user on start to use for subsequent requests."""
        self.user_id = None
        self.project_id = None
        self.voice_id = None

        # Create a test user
        email = f"loadtest-{uuid.uuid4().hex[:8]}@test.com"
        resp = self.client.post("/api/users", json={
            "email": email,
            "name": "Load Test User",
        }, name="/api/users [CREATE]")

        if resp.status_code == 201:
            data = resp.json()
            self.user_id = data.get("id")

    # ─── Health Check ────────────────────────────────────────────

    @tag("health")
    @task(2)
    def health_check(self):
        """GET /api/health"""
        self.client.get("/api/health")

    # ─── User Endpoints ─────────────────────────────────────────

    @tag("users")
    @task(3)
    def list_users(self):
        """GET /api/users"""
        self.client.get("/api/users")

    @tag("users")
    @task(2)
    def get_user(self):
        """GET /api/users/:id"""
        if not self.user_id:
            return
        self.client.get(f"/api/users/{self.user_id}", name="/api/users/:id")

    @tag("users")
    @task(1)
    def update_user(self):
        """PUT /api/users/:id"""
        if not self.user_id:
            return
        self.client.put(
            f"/api/users/{self.user_id}",
            json={"name": f"Updated-{uuid.uuid4().hex[:6]}"},
            name="/api/users/:id [UPDATE]",
        )

    # ─── Project Endpoints ───────────────────────────────────────

    @tag("projects")
    @task(3)
    def list_projects(self):
        """GET /api/projects"""
        self.client.get("/api/projects")

    @tag("projects")
    @task(2)
    def create_and_get_project(self):
        """POST + GET /api/projects"""
        if not self.user_id:
            return

        resp = self.client.post("/api/projects", json={
            "user_id": self.user_id,
            "name": f"LoadTest Project {uuid.uuid4().hex[:6]}",
            "description": "Created by Locust load test",
            "status": "draft",
            "nodes": [],
            "connections": [],
        }, name="/api/projects [CREATE]")

        if resp.status_code in (200, 201):
            data = resp.json()
            pid = data.get("id")
            if pid:
                self.project_id = pid
                self.client.get(f"/api/projects/{pid}", name="/api/projects/:id")

    @tag("projects")
    @task(1)
    def update_project(self):
        """PUT /api/projects/:id"""
        if not self.project_id:
            return
        self.client.put(
            f"/api/projects/{self.project_id}",
            json={
                "name": f"Updated-{uuid.uuid4().hex[:6]}",
                "description": "Updated by load test",
                "status": "draft",
                "nodes": [{"id": "1", "type": "input"}],
                "connections": [],
            },
            name="/api/projects/:id [UPDATE]",
        )

    # ─── Voice Endpoints ─────────────────────────────────────────

    @tag("voices")
    @task(2)
    def list_voices(self):
        """GET /api/voices"""
        self.client.get("/api/voices")

    @tag("voices")
    @task(1)
    def list_voices_by_user(self):
        """GET /api/voices/user/:user_id"""
        if not self.user_id:
            return
        self.client.get(
            f"/api/voices/user/{self.user_id}",
            name="/api/voices/user/:user_id",
        )

    @tag("voices")
    @task(1)
    def create_voice(self):
        """POST /api/voices"""
        if not self.user_id:
            return

        resp = self.client.post("/api/voices", json={
            "voice_name": f"LoadTest Voice {uuid.uuid4().hex[:6]}",
            "voice_url": "https://example.com/sample.wav",
            "ref_text": "Sample reference text for load testing",
            "gender": "female",
            "age_range": "adult",
            "language": "en",
            "user_id": self.user_id,
        }, name="/api/voices [CREATE]")

        if resp.status_code in (200, 201):
            data = resp.json()
            vid = data.get("id")
            if vid:
                self.voice_id = vid

    # ─── API Key Endpoints ───────────────────────────────────────

    @tag("apikeys")
    @task(1)
    def list_api_keys(self):
        """GET /api/users/:id/api-keys"""
        if not self.user_id:
            return
        self.client.get(
            f"/api/users/{self.user_id}/api-keys",
            name="/api/users/:id/api-keys",
        )

    # ─── Cleanup ─────────────────────────────────────────────────

    def on_stop(self):
        """Clean up test data on stop."""
        if self.voice_id:
            self.client.delete(
                f"/api/voices/{self.voice_id}",
                name="/api/voices/:id [DELETE]",
            )
        if self.project_id:
            self.client.delete(
                f"/api/projects/{self.project_id}",
                name="/api/projects/:id [DELETE]",
            )
        if self.user_id:
            self.client.delete(
                f"/api/users/{self.user_id}",
                name="/api/users/:id [DELETE]",
            )
