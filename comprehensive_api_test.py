#!/usr/bin/env python3
"""
Comprehensive API Testing Script for Loctician Booking System
Tests all major endpoints and integration functionality
"""

import asyncio
import json
import time
from typing import Dict, List, Optional
import aiohttp
import sys

API_BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3004"

class APITester:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None
        self.test_results: List[Dict] = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def add_result(self, test_name: str, status: str, message: str, data: Dict = None):
        """Add a test result"""
        result = {
            "test_name": test_name,
            "status": status,  # "PASS", "FAIL", "WARN"
            "message": message,
            "timestamp": time.time(),
            "data": data or {}
        }
        self.test_results.append(result)

        # Print immediate feedback
        status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_symbol} {test_name}: {message}")

    async def make_request(self, method: str, endpoint: str, data: Dict = None, auth: bool = False) -> Dict:
        """Make an HTTP request to the API"""
        url = f"{API_BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}

        if auth and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as response:
                    return {
                        "status": response.status,
                        "data": await response.json(),
                        "headers": dict(response.headers)
                    }
            elif method.upper() == "POST":
                async with self.session.post(url, headers=headers, json=data) as response:
                    return {
                        "status": response.status,
                        "data": await response.json(),
                        "headers": dict(response.headers)
                    }
            elif method.upper() == "PUT":
                async with self.session.put(url, headers=headers, json=data) as response:
                    return {
                        "status": response.status,
                        "data": await response.json(),
                        "headers": dict(response.headers)
                    }
        except Exception as e:
            return {
                "status": 0,
                "error": str(e),
                "data": None
            }

    async def test_backend_health(self):
        """Test backend health endpoints"""
        print("\n🔍 Testing Backend Health...")

        # Basic health check
        result = await self.make_request("GET", "/health")
        if result["status"] == 200:
            self.add_result("Backend Health", "PASS", "Backend is healthy", result["data"])
        else:
            self.add_result("Backend Health", "FAIL", f"Health check failed: {result.get('status', 'Unknown')}")

        # Database health check
        result = await self.make_request("GET", "/health/db")
        if result["status"] == 200:
            self.add_result("Database Health", "PASS", "Database connection healthy", result["data"])
        else:
            self.add_result("Database Health", "FAIL", f"DB health check failed: {result.get('status', 'Unknown')}")

        # API root endpoint
        result = await self.make_request("GET", "/")
        if result["status"] == 200:
            self.add_result("API Root", "PASS", "API root endpoint working", result["data"])
        else:
            self.add_result("API Root", "FAIL", f"API root failed: {result.get('status', 'Unknown')}")

    async def test_frontend_connectivity(self):
        """Test frontend connectivity"""
        print("\n🌐 Testing Frontend Connectivity...")

        try:
            async with self.session.get(FRONTEND_URL) as response:
                if response.status == 200:
                    self.add_result("Frontend Connectivity", "PASS", "Frontend is accessible")
                else:
                    self.add_result("Frontend Connectivity", "FAIL", f"Frontend returned status: {response.status}")
        except Exception as e:
            self.add_result("Frontend Connectivity", "FAIL", f"Frontend connection failed: {str(e)}")

    async def test_cors_configuration(self):
        """Test CORS configuration"""
        print("\n🔒 Testing CORS Configuration...")

        try:
            headers = {
                "Origin": "http://localhost:3004",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization"
            }

            async with self.session.options(f"{API_BASE_URL}/api/v1/auth/login", headers=headers) as response:
                cors_headers = response.headers

                if "Access-Control-Allow-Origin" in cors_headers:
                    self.add_result("CORS Configuration", "PASS", "CORS headers present", {
                        "allowed_origin": cors_headers.get("Access-Control-Allow-Origin"),
                        "allowed_methods": cors_headers.get("Access-Control-Allow-Methods"),
                        "allowed_headers": cors_headers.get("Access-Control-Allow-Headers")
                    })
                else:
                    self.add_result("CORS Configuration", "FAIL", "CORS headers missing")

        except Exception as e:
            self.add_result("CORS Configuration", "FAIL", f"CORS test failed: {str(e)}")

    async def test_authentication_flow(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Flow...")

        # Test registration with a unique email
        test_email = f"test_{int(time.time())}@example.com"
        registration_data = {
            "email": test_email,
            "password": "Password123#",
            "confirm_password": "Password123#",
            "first_name": "Test",
            "last_name": "User",
            "phone": "+45 12345678",
            "gdpr_consent": True
        }

        result = await self.make_request("POST", "/api/v1/auth/register", registration_data)
        if result["status"] in [200, 201]:
            self.add_result("User Registration", "PASS", "Registration successful", result["data"])
        elif result["status"] == 400 and "already exists" in str(result.get("data", {})):
            self.add_result("User Registration", "WARN", "User already exists (expected)")
        else:
            self.add_result("User Registration", "FAIL", f"Registration failed: {result.get('status', 'Unknown')}", result.get("data"))

        # Test login with existing user
        login_data = {
            "email": "test@example.com",
            "password": "Password123#"
        }

        result = await self.make_request("POST", "/api/v1/auth/login", login_data)
        if result["status"] == 200 and result["data"].get("access_token"):
            self.access_token = result["data"]["access_token"]
            self.add_result("User Login", "PASS", "Login successful", {
                "token_length": len(self.access_token),
                "user_info": result["data"].get("user", {})
            })
        else:
            self.add_result("User Login", "FAIL", f"Login failed: {result.get('status', 'Unknown')}", result.get("data"))

        # Test protected endpoint (me)
        if self.access_token:
            result = await self.make_request("GET", "/api/v1/auth/me", auth=True)
            if result["status"] == 200:
                self.add_result("Protected Endpoint", "PASS", "Auth token working", result["data"])
            else:
                self.add_result("Protected Endpoint", "FAIL", f"Protected endpoint failed: {result.get('status', 'Unknown')}")

    async def test_booking_endpoints(self):
        """Test booking-related endpoints"""
        print("\n📅 Testing Booking Endpoints...")

        if not self.access_token:
            self.add_result("Booking Endpoints", "FAIL", "No auth token available, skipping booking tests")
            return

        # Test list bookings
        result = await self.make_request("GET", "/api/v1/bookings/", auth=True)
        if result["status"] == 200:
            self.add_result("List Bookings", "PASS", f"Retrieved bookings list", {
                "count": len(result["data"]) if isinstance(result["data"], list) else "unknown"
            })
        else:
            self.add_result("List Bookings", "FAIL", f"List bookings failed: {result.get('status', 'Unknown')}")

        # Test availability check
        availability_data = {
            "loctician_id": "test-loctician-id",
            "date": "2024-12-01"
        }

        result = await self.make_request("POST", "/api/v1/bookings/check-availability", availability_data, auth=True)
        if result["status"] in [200, 404]:  # 404 might be expected if no loctician found
            self.add_result("Availability Check", "PASS", "Availability endpoint accessible")
        else:
            self.add_result("Availability Check", "FAIL", f"Availability check failed: {result.get('status', 'Unknown')}")

    async def test_user_management_endpoints(self):
        """Test user management endpoints"""
        print("\n👥 Testing User Management...")

        if not self.access_token:
            self.add_result("User Management", "FAIL", "No auth token available")
            return

        # Test list users (might require admin privileges)
        result = await self.make_request("GET", "/api/v1/users/", auth=True)
        if result["status"] in [200, 403]:  # 403 is expected for non-admin users
            status = "PASS" if result["status"] == 200 else "WARN"
            message = "User list accessible" if result["status"] == 200 else "User list requires admin privileges (expected)"
            self.add_result("List Users", status, message)
        else:
            self.add_result("List Users", "FAIL", f"User list failed: {result.get('status', 'Unknown')}")

    async def test_rate_limiting(self):
        """Test rate limiting functionality"""
        print("\n⏱️ Testing Rate Limiting...")

        # Test rate limit endpoint
        rapid_requests = []
        for i in range(6):  # Try 6 requests quickly to test rate limiting
            result = await self.make_request("GET", "/api/v1/test/rate-limit")
            rapid_requests.append(result["status"])

        if 429 in rapid_requests:  # Too Many Requests
            self.add_result("Rate Limiting", "PASS", "Rate limiting is working", {
                "status_codes": rapid_requests
            })
        else:
            self.add_result("Rate Limiting", "WARN", "Rate limiting might not be configured", {
                "status_codes": rapid_requests
            })

    async def test_websocket_endpoints(self):
        """Test WebSocket endpoints"""
        print("\n🔄 Testing WebSocket Endpoints...")

        # Test basic WebSocket connectivity (this is a simplified test)
        try:
            async with self.session.get(f"{API_BASE_URL}/ws") as response:
                if response.status in [101, 400, 405]:  # WebSocket upgrade or method not allowed
                    self.add_result("WebSocket Endpoint", "PASS", "WebSocket endpoint exists")
                else:
                    self.add_result("WebSocket Endpoint", "WARN", f"WebSocket endpoint returned: {response.status}")
        except Exception as e:
            self.add_result("WebSocket Endpoint", "WARN", f"WebSocket test inconclusive: {str(e)}")

    async def test_error_handling(self):
        """Test error handling"""
        print("\n🚨 Testing Error Handling...")

        # Test 404 handling
        result = await self.make_request("GET", "/api/v1/nonexistent-endpoint")
        if result["status"] == 404:
            self.add_result("404 Error Handling", "PASS", "404 errors handled correctly")
        else:
            self.add_result("404 Error Handling", "FAIL", f"Unexpected response for 404: {result.get('status', 'Unknown')}")

        # Test invalid JSON
        try:
            async with self.session.post(
                f"{API_BASE_URL}/api/v1/auth/login",
                headers={"Content-Type": "application/json"},
                data="invalid-json"
            ) as response:
                if response.status == 422:  # Unprocessable Entity
                    self.add_result("Invalid JSON Handling", "PASS", "Invalid JSON handled correctly")
                else:
                    self.add_result("Invalid JSON Handling", "WARN", f"Unexpected response for invalid JSON: {response.status}")
        except Exception as e:
            self.add_result("Invalid JSON Handling", "WARN", f"JSON error test failed: {str(e)}")

    def generate_report(self):
        """Generate a comprehensive test report"""
        print("\n" + "="*60)
        print("📊 COMPREHENSIVE INTEGRATION TEST REPORT")
        print("="*60)

        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        failed_tests = len([r for r in self.test_results if r["status"] == "FAIL"])
        warning_tests = len([r for r in self.test_results if r["status"] == "WARN"])

        print(f"\nTest Summary:")
        print(f"  Total Tests: {total_tests}")
        print(f"  ✅ Passed: {passed_tests}")
        print(f"  ❌ Failed: {failed_tests}")
        print(f"  ⚠️  Warnings: {warning_tests}")
        print(f"  Success Rate: {(passed_tests/total_tests)*100:.1f}%")

        print(f"\nDetailed Results:")
        for result in self.test_results:
            status_symbol = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
            print(f"  {status_symbol} {result['test_name']}: {result['message']}")

        # Critical Issues
        critical_failures = [r for r in self.test_results if r["status"] == "FAIL" and
                           any(keyword in r["test_name"].lower() for keyword in ["backend health", "database health", "frontend connectivity"])]

        if critical_failures:
            print(f"\n🚨 CRITICAL ISSUES:")
            for failure in critical_failures:
                print(f"  - {failure['test_name']}: {failure['message']}")

        # Integration Assessment
        print(f"\n🔍 Integration Assessment:")

        backend_healthy = any(r["test_name"] == "Backend Health" and r["status"] == "PASS" for r in self.test_results)
        frontend_accessible = any(r["test_name"] == "Frontend Connectivity" and r["status"] == "PASS" for r in self.test_results)
        auth_working = any(r["test_name"] == "User Login" and r["status"] == "PASS" for r in self.test_results)

        if backend_healthy and frontend_accessible:
            print("  ✅ Basic connectivity: Working")
        else:
            print("  ❌ Basic connectivity: Issues detected")

        if auth_working:
            print("  ✅ Authentication: Working")
        else:
            print("  ❌ Authentication: Issues detected")

        # Recommendations
        print(f"\n💡 Recommendations:")
        if failed_tests == 0:
            print("  - System appears to be working well!")
            print("  - Consider performance testing under load")
            print("  - Run security vulnerability scans")
        else:
            print("  - Fix critical backend/database connectivity issues first")
            print("  - Verify authentication system configuration")
            print("  - Check CORS settings for frontend integration")
            print("  - Review error handling and logging")

    async def run_all_tests(self):
        """Run all integration tests"""
        print("🚀 Starting Comprehensive Integration Testing...")
        print(f"Backend URL: {API_BASE_URL}")
        print(f"Frontend URL: {FRONTEND_URL}")

        await self.test_backend_health()
        await self.test_frontend_connectivity()
        await self.test_cors_configuration()
        await self.test_authentication_flow()
        await self.test_booking_endpoints()
        await self.test_user_management_endpoints()
        await self.test_rate_limiting()
        await self.test_websocket_endpoints()
        await self.test_error_handling()

        self.generate_report()

async def main():
    """Main test runner"""
    async with APITester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    print("Loctician Booking System - Comprehensive Integration Test")
    print("=" * 60)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
    except Exception as e:
        print(f"\n\n💥 Test runner failed: {str(e)}")
        sys.exit(1)