import os
import re
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class NoNakedCreateTaskTest(unittest.TestCase):
    def test_no_asyncio_create_task_in_app(self):
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
        whitelist = {os.path.join(root, "core", "async_utils.py")}
        patterns = [
            re.compile(r"\basyncio\.create_task\("),
            re.compile(r"\.create_task\("),
        ]

        violations = []
        for dirpath, _, filenames in os.walk(root):
            for fn in filenames:
                if not fn.endswith(".py"):
                    continue
                path = os.path.join(dirpath, fn)
                if path in whitelist:
                    continue
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
                for p in patterns:
                    if p.search(text):
                        violations.append(path)
                        break

        if violations:
            msg = "\n".join(violations)
            raise AssertionError(
                "检测到裸 create_task 调用，请改用 spawn_task(...) 或 start_background_task(...):\n" + msg
            )


if __name__ == "__main__":
    unittest.main()

