import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


ROOT = Path(__file__).resolve().parents[2]


class DeployConfigGuardrailsTest(unittest.TestCase):
    def test_prod_compose_explicitly_sets_environment_production(self):
        content = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
        self.assertIn("- ENVIRONMENT=production", content)

    def test_root_env_example_declares_environment(self):
        content = (ROOT / ".env.example").read_text(encoding="utf-8")
        self.assertIn("ENVIRONMENT=production", content)

    def test_backend_env_example_declares_environment(self):
        content = (ROOT / "backend" / ".env.example").read_text(encoding="utf-8")
        self.assertIn("ENVIRONMENT=production", content)

    def test_dockerfile_defaults_to_production_environment(self):
        content = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("ENVIRONMENT=production", content)

    def test_prod_compose_exposes_single_ai_env_vars(self):
        content = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
        self.assertIn("SINGLE_AI_API_KEY", content)
        self.assertIn("SINGLE_AI_MODEL", content)
        self.assertIn("SINGLE_AI_API_BASE", content)

    def test_render_backend_exposes_single_ai_env_vars(self):
        content = (ROOT / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("SINGLE_AI_API_KEY", content)
        self.assertIn("SINGLE_AI_MODEL", content)
        self.assertIn("SINGLE_AI_API_BASE", content)

    def test_env_examples_document_single_ai_env_vars(self):
        root_content = (ROOT / ".env.example").read_text(encoding="utf-8")
        backend_content = (ROOT / "backend" / ".env.example").read_text(encoding="utf-8")
        for content in (root_content, backend_content):
            self.assertIn("SINGLE_AI_API_KEY", content)
            self.assertIn("SINGLE_AI_MODEL", content)
            self.assertIn("SINGLE_AI_API_BASE", content)

    def test_docker_runtime_creates_persisted_backend_data_dir(self):
        content = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("/app/backend/data", content)

    def test_compose_persists_same_backend_data_dir_as_app_default(self):
        content = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("/app/backend/data", content)

    def test_dev_compose_exposes_single_ai_env_vars(self):
        content = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("SINGLE_AI_API_KEY", content)
        self.assertIn("SINGLE_AI_MODEL", content)
        self.assertIn("SINGLE_AI_API_BASE", content)

    def test_readme_mentions_single_ai_env_vars_for_deploy(self):
        content = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("SINGLE_AI_API_KEY", content)

    def test_render_python_version_matches_docker_runtime_major_minor(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        render = (ROOT / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("python:3.11", dockerfile)
        self.assertIn("value: 3.11", render)

    def test_render_frontend_uses_backend_service_reference_instead_of_hardcoded_url(self):
        render = (ROOT / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("envVarKey: RENDER_EXTERNAL_URL", render)
        self.assertNotIn("baccarat-backend.onrender.com", render)

    def test_prod_compose_does_not_publish_postgres_port(self):
        content = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
        self.assertNotIn('"5432:5432"', content)

    def test_prod_compose_overrides_postgres_default_credentials(self):
        content = (ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
        self.assertIn("POSTGRES_USER=${POSTGRES_USER}", content)
        self.assertIn("POSTGRES_PASSWORD=${POSTGRES_PASSWORD}", content)
        self.assertIn("POSTGRES_DB=${POSTGRES_DB}", content)


if __name__ == "__main__":
    unittest.main()
