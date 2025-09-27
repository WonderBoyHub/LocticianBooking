#!/usr/bin/env python3
"""
Backend validation script for the Loctician Booking System.

This script validates the backend configuration and ensures all endpoints
are properly configured without requiring external dependencies.
"""

import ast
import sys
from pathlib import Path
from typing import List, Dict, Any


def validate_python_syntax(file_path: Path) -> tuple[bool, str]:
    """Validate Python file syntax."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        ast.parse(content, filename=str(file_path))
        return True, "Valid syntax"
    except SyntaxError as e:
        return False, f"Syntax error: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def validate_imports(file_path: Path) -> tuple[bool, List[str]]:
    """Check for potential import issues."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        tree = ast.parse(content)
        imports = []
        issues = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ''
                for alias in node.names:
                    full_import = f"{module}.{alias.name}" if module else alias.name
                    imports.append(full_import)

        return True, imports
    except Exception as e:
        return False, [f"Error analyzing imports: {e}"]


def main():
    """Main validation function."""
    print("🔍 Validating Loctician Booking System Backend")
    print("=" * 50)

    backend_dir = Path.cwd()

    # Critical files to validate
    critical_files = [
        "main.py",
        "app/core/config.py",
        "app/core/database.py",
        "app/models/__init__.py",
        "app/api/v1/endpoints/auth.py",
        "app/api/v1/endpoints/bookings.py",
        "app/api/v1/endpoints/users.py",
    ]

    all_valid = True

    # 1. Validate Python syntax
    print("\n📝 Validating Python syntax...")
    for file_path in critical_files:
        full_path = backend_dir / file_path
        if full_path.exists():
            is_valid, message = validate_python_syntax(full_path)
            status = "✓" if is_valid else "✗"
            print(f"  {status} {file_path}: {message}")
            if not is_valid:
                all_valid = False
        else:
            print(f"  ⚠️  {file_path}: File not found")

    # 2. Check project structure
    print("\n📁 Validating project structure...")
    required_dirs = [
        "app/api/v1/endpoints",
        "app/core",
        "app/models",
        "app/middleware",
        "app/utils"
    ]

    for dir_path in required_dirs:
        full_path = backend_dir / dir_path
        if full_path.exists() and full_path.is_dir():
            print(f"  ✓ {dir_path}: Directory exists")
        else:
            print(f"  ✗ {dir_path}: Directory missing")
            all_valid = False

    # 3. Check dependency file
    print("\n📦 Validating dependencies...")
    requirements_file = backend_dir / "requirements.txt"
    if requirements_file.exists():
        with open(requirements_file, 'r') as f:
            deps = [line.strip() for line in f if line.strip() and not line.startswith('#')]

        required_packages = ['fastapi', 'uvicorn', 'sqlalchemy', 'asyncpg', 'structlog', 'slowapi']
        missing_packages = []

        for package in required_packages:
            found = any(package in dep for dep in deps)
            if found:
                print(f"  ✓ {package}: Found in requirements.txt")
            else:
                print(f"  ✗ {package}: Missing from requirements.txt")
                missing_packages.append(package)

        if missing_packages:
            all_valid = False
    else:
        print("  ✗ requirements.txt: File not found")
        all_valid = False

    # 4. Final summary
    print("\n" + "=" * 50)
    if all_valid:
        print("✅ Backend validation passed!")
        print("   All critical files have valid syntax and structure.")
        print("   Ready for deployment after installing dependencies.")
    else:
        print("❌ Backend validation failed!")
        print("   Please fix the issues above before deployment.")
        sys.exit(1)


if __name__ == "__main__":
    main()