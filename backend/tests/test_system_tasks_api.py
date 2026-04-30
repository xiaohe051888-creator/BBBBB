import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemTasksApiTest(unittest.TestCase):
    def test_diagnostics_include_background_tasks(self):
        from app.api.routes import system as system_routes

        async def _run():
            return await system_routes.get_system_diagnostics()

        data = asyncio.run(_run())
        self.assertIn("background_tasks", data)


if __name__ == "__main__":
    unittest.main()

