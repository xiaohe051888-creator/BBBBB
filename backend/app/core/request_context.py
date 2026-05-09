from contextvars import ContextVar


current_actor: ContextVar[dict | None] = ContextVar("current_actor", default=None)


def set_current_actor(actor: dict | None) -> None:
    current_actor.set(actor)


def get_current_actor() -> dict | None:
    return current_actor.get()

