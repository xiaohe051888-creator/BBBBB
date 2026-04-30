import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemStatePublicTest(unittest.TestCase):
    def test_system_state_route_is_public(self):
        async def _run():
            from app.core.database import init_db
            from app.api.routes.system import get_system_state

            await init_db()
            data = await get_system_state()
            return data

        data = asyncio.run(_run())
        self.assertIsInstance(data, dict)
        self.assertIn("status", data)
        self.assertIn("boot_number", data)
        self.assertIn("balance", data)


if __name__ == "__main__":
    unittest.main()

