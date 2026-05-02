import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AnalysisDedupeTest(unittest.TestCase):
    def test_analysis_dedupe_key_prevents_duplicates(self):
        async def _run():
            from app.core.database import init_db
            from app.services.game.task_registry import registry

            async def job():
                await asyncio.sleep(0.01)

            await init_db()

            meta1 = registry.create("analysis", job(), boot_number=1, dedupe_key="analysis:1")
            meta2 = registry.create("analysis", job(), boot_number=1, dedupe_key="analysis:1")

            self.assertEqual(meta1.task_id, meta2.task_id)
            await meta1.task

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
