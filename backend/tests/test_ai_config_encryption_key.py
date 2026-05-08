import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class AiConfigEncryptionKeyTest(unittest.TestCase):
    def test_decrypt_remains_compatible_with_legacy_jwt_based_ciphertext(self):
        prev = {
            "AI_CONFIG_ENCRYPTION_KEY": os.environ.get("AI_CONFIG_ENCRYPTION_KEY"),
            "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY"),
        }
        try:
            os.environ.pop("AI_CONFIG_ENCRYPTION_KEY", None)
            os.environ["JWT_SECRET_KEY"] = "jwt-secret-before"

            from app.services.ai_config_store import encrypt_api_key, decrypt_api_key

            encrypted = encrypt_api_key("sk-legacy-value-1234567890")
            os.environ["AI_CONFIG_ENCRYPTION_KEY"] = "ai-config-secret-1234567890"

            self.assertEqual(
                decrypt_api_key(encrypted),
                "sk-legacy-value-1234567890",
            )
        finally:
            for k, v in prev.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_encrypt_and_decrypt_do_not_depend_on_jwt_secret_when_dedicated_key_is_set(self):
        prev = {
            "AI_CONFIG_ENCRYPTION_KEY": os.environ.get("AI_CONFIG_ENCRYPTION_KEY"),
            "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY"),
        }
        try:
            os.environ["AI_CONFIG_ENCRYPTION_KEY"] = "ai-config-secret-1234567890"
            os.environ["JWT_SECRET_KEY"] = "jwt-secret-before"

            from app.services.ai_config_store import encrypt_api_key, decrypt_api_key

            encrypted = encrypt_api_key("sk-secret-value-1234567890")
            os.environ["JWT_SECRET_KEY"] = "jwt-secret-after"

            self.assertEqual(
                decrypt_api_key(encrypted),
                "sk-secret-value-1234567890",
            )
        finally:
            for k, v in prev.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main()
