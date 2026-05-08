import os


def validate_production_security() -> None:
    env = (os.getenv("ENVIRONMENT") or "development").lower()
    if env != "production":
        return

    errors: list[str] = []

    jwt_secret = (os.getenv("JWT_SECRET_KEY") or "").strip()
    jwt_placeholder_markers = (
        "change-me-in-production",
        "your-super-secret-key",
    )
    if (
        not jwt_secret
        or any(marker in jwt_secret.lower() for marker in jwt_placeholder_markers)
    ):
        errors.append("必须设置 JWT_SECRET_KEY（且不能使用占位值）")

    admin_pwd = (os.getenv("ADMIN_DEFAULT_PASSWORD") or "").strip()
    admin_placeholder_values = {
        "8888",
        "yoursecurepassword123!",
    }
    if not admin_pwd or admin_pwd.lower() in admin_placeholder_values:
        errors.append("必须设置 ADMIN_DEFAULT_PASSWORD（且不能使用默认弱口令）")

    cors = (os.getenv("CORS_ORIGINS") or "").strip()
    if cors == "*":
        errors.append("CORS_ORIGINS 不允许为 *，请设置为你的前端域名")
    if any(host in cors.lower() for host in ("localhost", "127.0.0.1")):
        errors.append("CORS_ORIGINS 不允许使用 localhost/127.0.0.1，请设置为真实前端域名")

    if errors:
        raise RuntimeError("生产环境安全配置不合规：" + "；".join(errors))
