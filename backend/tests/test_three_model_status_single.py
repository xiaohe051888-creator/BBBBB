import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ThreeModelStatusSingleTest(unittest.TestCase):
    def test_three_model_status_includes_single(self):
        async def _run():
            from app.api.routes.auth import get_three_model_status
            return await get_three_model_status({})

        data = asyncio.run(_run())
        self.assertIn("models", data)
        self.assertIn("single", data["models"])


if __name__ == "__main__":
    unittest.main()

