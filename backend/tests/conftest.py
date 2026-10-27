import pytest
from fastapi.testclient import TestClient
import sys
import os

# Ensure backend root is on Python module path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app


@pytest.fixture(scope="session")
def client():
    """Provides a thread-safe test client for the FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client
