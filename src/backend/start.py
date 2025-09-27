#!/usr/bin/env python3
"""
Startup script for the Loctician Booking System FastAPI backend.

This script provides a production-ready way to start the application with
proper configuration, health checks, and graceful shutdown handling.
"""
import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from uvicorn.config import LOGGING_CONFIG

# Add the src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from app.core.database import close_db


class LocticianServer:
    """Loctician Booking System server manager."""

    def __init__(self):
        self.server = None
        self.should_exit = False

    async def startup(self):
        """Perform startup tasks."""
        print("🚀 Starting Loctician Booking System...")
        print(f"📊 Environment: {settings.ENVIRONMENT}")
        print(f"🐞 Debug mode: {settings.DEBUG}")
        print(f"🌐 API version: {settings.PROJECT_VERSION}")

        try:
            # Database initialization and health checks are handled by FastAPI lifespan in main.py

            # Create upload directory if it doesn't exist
            upload_path = Path(settings.UPLOAD_PATH)
            upload_path.mkdir(parents=True, exist_ok=True)
            print(f"📁 Upload directory ready: {upload_path.absolute()}")

            print("🎉 Startup completed successfully!")

        except Exception as e:
            print(f"💥 Startup failed: {e}")
            raise

    async def shutdown(self):
        """Perform shutdown tasks."""
        print("🛑 Shutting down Loctician Booking System...")

        try:
            # Close database connections
            await close_db()
            print("✅ Database connections closed")

            print("👋 Shutdown completed successfully")

        except Exception as e:
            print(f"⚠️  Error during shutdown: {e}")

    def setup_logging(self):
        """Configure logging for the application."""
        # Update uvicorn logging config
        LOGGING_CONFIG["formatters"]["default"]["fmt"] = (
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        LOGGING_CONFIG["formatters"]["access"]["fmt"] = (
            "%(asctime)s - %(client_addr)s - \"%(request_line)s\" %(status_code)s"
        )

        # Set log level
        logging.basicConfig(
            level=getattr(logging, settings.LOG_LEVEL.upper()),
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown."""

        def signal_handler(signum, frame):
            print(f"\\n🔄 Received signal {signum}, initiating graceful shutdown...")
            self.should_exit = True

        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

    async def run_server(self):
        """Run the FastAPI server."""
        config = uvicorn.Config(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=settings.DEBUG,
            log_level=settings.LOG_LEVEL.lower(),
            access_log=True,
            reload_dirs=["app"] if settings.DEBUG else None,
            reload_includes=["*.py"] if settings.DEBUG else None,
            workers=1,  # Use 1 worker for development, more for production
        )

        server = uvicorn.Server(config)

        # Override the default startup/shutdown
        original_startup = server.startup
        original_shutdown = server.shutdown

        async def startup_wrapper(*args, **kwargs):
            await self.startup()
            if original_startup:
                await original_startup(*args, **kwargs)

        async def shutdown_wrapper(*args, **kwargs):
            if original_shutdown:
                await original_shutdown(*args, **kwargs)
            await self.shutdown()

        server.startup = startup_wrapper
        server.shutdown = shutdown_wrapper

        print(f"🌐 Starting server on http://0.0.0.0:8000")
        print(f"📚 API documentation: http://0.0.0.0:8000/docs")
        print(f"🔍 Health check: http://0.0.0.0:8000/health")

        await server.serve()

    async def main(self):
        """Main application entrypoint."""
        self.setup_logging()
        self.setup_signal_handlers()

        try:
            await self.run_server()
        except KeyboardInterrupt:
            print("\\n⏹️  Server interrupted by user")
        except Exception as e:
            print(f"💥 Server error: {e}")
            raise
        finally:
            if not self.should_exit:
                await self.shutdown()


def main():
    """Entry point for the application."""
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        sys.exit(1)

    # Check if .env file exists
    env_file = Path(".env")
    if not env_file.exists():
        print("⚠️  .env file not found. Please copy .env.example to .env and configure it.")
        print("📝 You can do this with: cp .env.example .env")
        if input("Continue anyway? (y/N): ").lower() != 'y':
            sys.exit(1)

    # Validate required environment variables
    required_vars = [
        "DATABASE_URL",
        "SECRET_KEY",
    ]

    missing_vars = []
    for var in required_vars:
        # Use settings to read values so `.env` entries are respected.
        value = getattr(settings, var, None)
        if value is None:
            missing_vars.append(var)
        elif isinstance(value, str) and not value.strip():
            missing_vars.append(var)

    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("📝 Please check your .env file configuration")
        sys.exit(1)

    # Show startup banner
    print("=" * 60)
    print("🎯 LOCTICIAN BOOKING SYSTEM")
    print("🔧 FastAPI Backend Server")
    print(f"📦 Version: {settings.PROJECT_VERSION}")
    print("=" * 60)

    # Run the server
    server = LocticianServer()
    try:
        asyncio.run(server.main())
    except KeyboardInterrupt:
        print("\\n👋 Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
