import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


def pytest_addoption(parser):
    parser.addoption("--run-slow", action="store_true", default=False, help="Run slow experiment regression tests")


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: marks tests as slow (skipped by default; run with --run-slow)")


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--run-slow"):
        skip = pytest.mark.skip(reason="slow test — use --run-slow to run")
        for item in items:
            if "slow" in item.keywords:
                item.add_marker(skip)
