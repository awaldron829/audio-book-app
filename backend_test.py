#!/usr/bin/env python3
"""
Smart Audiobook Player Backend API Test Suite
Tests all backend endpoints with realistic audiobook data
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend env
BACKEND_URL = "https://listen-smart-app.preview.emergentagent.com/api"

# Test data as specified in the review request
TEST_BOOK_DATA = {
    "id": "book_12345",
    "title": "Test Audiobook",
    "path": "/storage/audiobooks/test.mp3",
    "duration": 3600000,  # 1 hour in milliseconds
    "file_count": 10,
    "is_series": False,
    "series_name": None
}

TEST_PROGRESS_DATA = {
    "book_id": "book_12345",
    "position": 1800000,  # 30 minutes
    "duration": 3600000,
    "current_file_index": 5
}

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data
        })
        
    def test_health_check(self):
        """Test GET /api/ - Health check endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Smart Audiobook Player API" in data["message"]:
                    self.log_result("Health Check", True, f"API is healthy: {data['message']}", data)
                else:
                    self.log_result("Health Check", False, f"Unexpected response format: {data}", data)
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
    
    def test_create_book(self):
        """Test POST /api/books - Create audiobook"""
        try:
            response = self.session.post(f"{BACKEND_URL}/books", json=TEST_BOOK_DATA)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success" and data.get("book_id") == TEST_BOOK_DATA["id"]:
                    self.log_result("Create Book", True, f"Book created successfully: {data['book_id']}", data)
                else:
                    self.log_result("Create Book", False, f"Unexpected response: {data}", data)
            else:
                self.log_result("Create Book", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Create Book", False, f"Request error: {str(e)}")
    
    def test_get_all_books(self):
        """Test GET /api/books - Get all books"""
        try:
            response = self.session.get(f"{BACKEND_URL}/books")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if our test book is in the list
                    test_book_found = any(book.get("id") == TEST_BOOK_DATA["id"] for book in data)
                    if test_book_found:
                        self.log_result("Get All Books", True, f"Retrieved {len(data)} books, test book found", {"count": len(data)})
                    else:
                        self.log_result("Get All Books", False, f"Test book not found in {len(data)} books", {"count": len(data), "books": data})
                else:
                    self.log_result("Get All Books", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_result("Get All Books", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get All Books", False, f"Request error: {str(e)}")
    
    def test_get_specific_book(self):
        """Test GET /api/books/{book_id} - Get specific book"""
        try:
            response = self.session.get(f"{BACKEND_URL}/books/{TEST_BOOK_DATA['id']}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("id") == TEST_BOOK_DATA["id"] and data.get("title") == TEST_BOOK_DATA["title"]:
                    self.log_result("Get Specific Book", True, f"Retrieved book: {data['title']}", data)
                else:
                    self.log_result("Get Specific Book", False, f"Book data mismatch: {data}", data)
            else:
                self.log_result("Get Specific Book", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get Specific Book", False, f"Request error: {str(e)}")
    
    def test_get_nonexistent_book(self):
        """Test GET /api/books/{book_id} - Error handling for non-existent book"""
        try:
            response = self.session.get(f"{BACKEND_URL}/books/nonexistent_book_id")
            
            if response.status_code == 404:
                data = response.json()
                if "not found" in data.get("detail", "").lower():
                    self.log_result("Get Nonexistent Book", True, "Correctly returned 404 for non-existent book", data)
                else:
                    self.log_result("Get Nonexistent Book", False, f"404 but unexpected message: {data}", data)
            else:
                self.log_result("Get Nonexistent Book", False, f"Expected 404, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get Nonexistent Book", False, f"Request error: {str(e)}")
    
    def test_save_progress(self):
        """Test POST /api/progress - Save playback progress"""
        try:
            response = self.session.post(f"{BACKEND_URL}/progress", json=TEST_PROGRESS_DATA)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_result("Save Progress", True, "Progress saved successfully", data)
                else:
                    self.log_result("Save Progress", False, f"Unexpected response: {data}", data)
            else:
                self.log_result("Save Progress", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Save Progress", False, f"Request error: {str(e)}")
    
    def test_get_progress(self):
        """Test GET /api/progress/{book_id} - Get progress for specific book"""
        try:
            response = self.session.get(f"{BACKEND_URL}/progress/{TEST_PROGRESS_DATA['book_id']}")
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("book_id") == TEST_PROGRESS_DATA["book_id"] and 
                    data.get("position") == TEST_PROGRESS_DATA["position"]):
                    self.log_result("Get Progress", True, f"Retrieved progress: {data['position']}ms", data)
                else:
                    self.log_result("Get Progress", False, f"Progress data mismatch: {data}", data)
            else:
                self.log_result("Get Progress", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get Progress", False, f"Request error: {str(e)}")
    
    def test_get_all_progress(self):
        """Test GET /api/progress - Get all progress entries"""
        try:
            response = self.session.get(f"{BACKEND_URL}/progress")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if our test progress is in the list
                    test_progress_found = any(p.get("book_id") == TEST_PROGRESS_DATA["book_id"] for p in data)
                    if test_progress_found:
                        self.log_result("Get All Progress", True, f"Retrieved {len(data)} progress entries, test progress found", {"count": len(data)})
                    else:
                        self.log_result("Get All Progress", False, f"Test progress not found in {len(data)} entries", {"count": len(data), "progress": data})
                else:
                    self.log_result("Get All Progress", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_result("Get All Progress", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get All Progress", False, f"Request error: {str(e)}")
    
    def test_mark_complete(self):
        """Test POST /api/progress/complete/{book_id} - Mark book as complete"""
        try:
            response = self.session.post(f"{BACKEND_URL}/progress/complete/{TEST_PROGRESS_DATA['book_id']}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_result("Mark Complete", True, "Book marked as complete", data)
                    
                    # Verify completion by getting progress
                    verify_response = self.session.get(f"{BACKEND_URL}/progress/{TEST_PROGRESS_DATA['book_id']}")
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        if verify_data.get("completed") == True:
                            self.log_result("Verify Completion", True, "Completion status verified", verify_data)
                        else:
                            self.log_result("Verify Completion", False, f"Book not marked as completed: {verify_data}", verify_data)
                else:
                    self.log_result("Mark Complete", False, f"Unexpected response: {data}", data)
            else:
                self.log_result("Mark Complete", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Mark Complete", False, f"Request error: {str(e)}")
    
    def test_reset_progress(self):
        """Test DELETE /api/progress/{book_id} - Reset progress"""
        try:
            response = self.session.delete(f"{BACKEND_URL}/progress/{TEST_PROGRESS_DATA['book_id']}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_result("Reset Progress", True, "Progress reset successfully", data)
                    
                    # Verify reset by getting progress (should return default values)
                    verify_response = self.session.get(f"{BACKEND_URL}/progress/{TEST_PROGRESS_DATA['book_id']}")
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        if verify_data.get("position") == 0.0:
                            self.log_result("Verify Reset", True, "Progress reset verified", verify_data)
                        else:
                            self.log_result("Verify Reset", False, f"Progress not reset: {verify_data}", verify_data)
                else:
                    self.log_result("Reset Progress", False, f"Unexpected response: {data}", data)
            else:
                self.log_result("Reset Progress", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Reset Progress", False, f"Request error: {str(e)}")
    
    def test_reset_nonexistent_progress(self):
        """Test DELETE /api/progress/{book_id} - Error handling for non-existent progress"""
        try:
            response = self.session.delete(f"{BACKEND_URL}/progress/nonexistent_book_id")
            
            if response.status_code == 404:
                data = response.json()
                if "not found" in data.get("detail", "").lower():
                    self.log_result("Reset Nonexistent Progress", True, "Correctly returned 404 for non-existent progress", data)
                else:
                    self.log_result("Reset Nonexistent Progress", False, f"404 but unexpected message: {data}", data)
            else:
                self.log_result("Reset Nonexistent Progress", False, f"Expected 404, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Reset Nonexistent Progress", False, f"Request error: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"🚀 Starting Smart Audiobook Player API Tests")
        print(f"📡 Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Test sequence designed to build up data and then test operations
        self.test_health_check()
        self.test_create_book()
        self.test_get_all_books()
        self.test_get_specific_book()
        self.test_get_nonexistent_book()
        self.test_save_progress()
        self.test_get_progress()
        self.test_get_all_progress()
        self.test_mark_complete()
        self.test_reset_progress()
        self.test_reset_nonexistent_progress()
        
        print("=" * 60)
        
        # Summary
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        
        print(f"📊 Test Summary: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            failed_tests = [r["test"] for r in self.results if not r["success"]]
            print(f"❌ Failed tests: {', '.join(failed_tests)}")
            return False

def main():
    """Main test execution"""
    tester = APITester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()