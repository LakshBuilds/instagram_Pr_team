#!/usr/bin/env python3
"""
Instagram Rate Limiting Test System
Tests how many requests we can send from one account before hitting limits
Monitors for captcha, blocks, and rate limiting responses
"""

import requests
import time
import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qs

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rate_limit_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TestResult:
    """Result of a single API test"""
    timestamp: datetime
    request_number: int
    success: bool
    response_code: int
    response_time: float
    error_type: Optional[str] = None
    captcha_detected: bool = False
    rate_limited: bool = False
    blocked: bool = False
    response_size: int = 0
    response_headers: Dict = None

@dataclass
class AccountConfig:
    """Configuration for a test account"""
    name: str
    apify_token: str
    user_agent: str
    proxy: Optional[str] = None
    session_cookies: Optional[Dict] = None

class InstagramRateLimitTester:
    """
    Comprehensive rate limiting tester for Instagram APIs
    """
    
    def __init__(self):
        self.results: List[TestResult] = []
        self.test_urls = [
            "https://www.instagram.com/reel/C4QxQxQxQxQ/",  # Sample reel URLs
            "https://www.instagram.com/reel/C5RyRyRyRyR/",
            "https://www.instagram.com/reel/C6SzSzSzSzS/",
            "https://www.instagram.com/reel/C7TaTaTaTaT/",
            "https://www.instagram.com/reel/C8UbUbUbUbU/",
        ]
        self.apify_actor_id = "shu8hvrXbJbY3Eb9W"
        self.session = requests.Session()
        
    def setup_session(self, account: AccountConfig):
        """Setup session with account-specific configuration"""
        self.session.headers.update({
            'User-Agent': account.user_agent,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
        
        if account.session_cookies:
            self.session.cookies.update(account.session_cookies)
            
        if account.proxy:
            self.session.proxies.update({
                'http': account.proxy,
                'https': account.proxy
            })
    
    def test_apify_rate_limits(self, account: AccountConfig, max_requests: int = 100) -> List[TestResult]:
        """
        Test Apify API rate limits with a single account
        """
        logger.info(f"🚀 Starting Apify rate limit test with account: {account.name}")
        logger.info(f"📊 Testing up to {max_requests} requests")
        
        self.setup_session(account)
        results = []
        
        for i in range(1, max_requests + 1):
            # Use random URL to avoid caching
            test_url = random.choice(self.test_urls)
            
            logger.info(f"📤 Request {i}/{max_requests}: Testing {test_url}")
            
            start_time = time.time()
            result = self._make_apify_request(account.apify_token, test_url, i)
            result.response_time = time.time() - start_time
            
            results.append(result)
            self.results.append(result)
            
            # Log result
            status = "✅ SUCCESS" if result.success else "❌ FAILED"
            logger.info(f"{status} - Code: {result.response_code}, Time: {result.response_time:.2f}s")
            
            if result.captcha_detected:
                logger.warning("🤖 CAPTCHA detected - stopping test")
                break
                
            if result.blocked:
                logger.warning("🚫 Account blocked - stopping test")
                break
                
            if result.rate_limited:
                logger.warning("⏰ Rate limited - continuing with delays")
                time.sleep(60)  # Wait 1 minute on rate limit
                
            # Add random delay between requests (1-5 seconds)
            delay = random.uniform(1, 5)
            logger.info(f"⏳ Waiting {delay:.1f}s before next request...")
            time.sleep(delay)
            
        logger.info(f"🏁 Test completed. Total requests: {len(results)}")
        return results
    
    def _make_apify_request(self, api_token: str, instagram_url: str, request_num: int) -> TestResult:
        """
        Make a single request to Apify API and analyze the response
        """
        try:
            # Prepare Apify actor run request
            run_url = f"https://api.apify.com/v2/acts/{self.apify_actor_id}/runs?token={api_token}"
            
            payload = {
                "startUrls": [{"url": instagram_url}],
                "maxItems": 1,
                "extendOutputFunction": "",
                "customMapFunction": "",
                "proxy": {"useApifyProxy": True}
            }
            
            # Make the request
            response = self.session.post(
                run_url,
                json=payload,
                timeout=30
            )
            
            # Analyze response
            result = TestResult(
                timestamp=datetime.now(),
                request_number=request_num,
                success=response.status_code == 201,
                response_code=response.status_code,
                response_time=0,  # Will be set by caller
                response_size=len(response.content),
                response_headers=dict(response.headers)
            )
            
            # Check for various error conditions
            if response.status_code == 429:
                result.rate_limited = True
                result.error_type = "rate_limited"
                logger.warning("⏰ Rate limit detected (429)")
                
            elif response.status_code == 403:
                result.blocked = True
                result.error_type = "blocked"
                logger.warning("🚫 Access forbidden (403)")
                
            elif response.status_code >= 400:
                result.error_type = f"http_error_{response.status_code}"
                
            # Check response content for captcha/blocking indicators
            try:
                response_text = response.text.lower()
                if any(indicator in response_text for indicator in [
                    'captcha', 'challenge', 'verify', 'suspicious', 'blocked'
                ]):
                    result.captcha_detected = True
                    result.error_type = "captcha_or_challenge"
                    logger.warning("🤖 Captcha or challenge detected in response")
                    
            except Exception as e:
                logger.debug(f"Could not analyze response text: {e}")
                
            # If successful, wait for run completion and check dataset
            if result.success:
                try:
                    run_data = response.json()
                    run_id = run_data.get('data', {}).get('id')
                    
                    if run_id:
                        # Wait for completion and check results
                        dataset_result = self._wait_for_run_completion(api_token, run_id)
                        if dataset_result:
                            result.success = dataset_result['success']
                            if not dataset_result['success']:
                                result.error_type = dataset_result.get('error_type', 'dataset_error')
                                
                except Exception as e:
                    logger.debug(f"Could not process run completion: {e}")
                    result.error_type = "run_processing_error"
                    
            return result
            
        except requests.exceptions.Timeout:
            return TestResult(
                timestamp=datetime.now(),
                request_number=request_num,
                success=False,
                response_code=0,
                response_time=0,
                error_type="timeout"
            )
            
        except requests.exceptions.ConnectionError:
            return TestResult(
                timestamp=datetime.now(),
                request_number=request_num,
                success=False,
                response_code=0,
                response_time=0,
                error_type="connection_error"
            )
            
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return TestResult(
                timestamp=datetime.now(),
                request_number=request_num,
                success=False,
                response_code=0,
                response_time=0,
                error_type=f"unexpected_error: {str(e)}"
            )
    
    def _wait_for_run_completion(self, api_token: str, run_id: str, max_wait: int = 120) -> Optional[Dict]:
        """
        Wait for Apify run completion and analyze results
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            try:
                # Check run status
                status_url = f"https://api.apify.com/v2/actor-runs/{run_id}?token={api_token}"
                status_response = self.session.get(status_url, timeout=10)
                
                if status_response.status_code != 200:
                    return {"success": False, "error_type": "status_check_failed"}
                    
                status_data = status_response.json()
                run_status = status_data.get('data', {}).get('status')
                
                if run_status == 'SUCCEEDED':
                    # Get dataset results
                    dataset_id = status_data.get('data', {}).get('defaultDatasetId')
                    if dataset_id:
                        return self._check_dataset_results(api_token, dataset_id)
                    else:
                        return {"success": False, "error_type": "no_dataset_id"}
                        
                elif run_status in ['FAILED', 'ABORTED', 'TIMED-OUT']:
                    return {"success": False, "error_type": f"run_{run_status.lower()}"}
                    
                # Still running, wait a bit
                time.sleep(5)
                
            except Exception as e:
                logger.debug(f"Error checking run status: {e}")
                return {"success": False, "error_type": "status_check_error"}
                
        return {"success": False, "error_type": "run_timeout"}
    
    def _check_dataset_results(self, api_token: str, dataset_id: str) -> Dict:
        """
        Check dataset results for successful data extraction
        """
        try:
            dataset_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={api_token}"
            dataset_response = self.session.get(dataset_url, timeout=10)
            
            if dataset_response.status_code != 200:
                return {"success": False, "error_type": "dataset_fetch_failed"}
                
            dataset_items = dataset_response.json()
            
            if not dataset_items or len(dataset_items) == 0:
                return {"success": False, "error_type": "no_data_extracted"}
                
            # Check if we got actual Instagram data or error responses
            first_item = dataset_items[0]
            
            if isinstance(first_item, dict):
                # Check for error indicators
                if first_item.get('error') or first_item.get('errorDescription'):
                    error_desc = first_item.get('errorDescription', first_item.get('error', 'unknown'))
                    if 'restricted' in error_desc.lower() or 'private' in error_desc.lower():
                        return {"success": True, "data_type": "restricted_content"}
                    else:
                        return {"success": False, "error_type": f"data_error: {error_desc}"}
                        
                # Check for actual Instagram data
                if first_item.get('shortCode') or first_item.get('likesCount') is not None:
                    return {"success": True, "data_type": "instagram_data"}
                    
            return {"success": False, "error_type": "invalid_data_format"}
            
        except Exception as e:
            logger.debug(f"Error checking dataset: {e}")
            return {"success": False, "error_type": "dataset_check_error"}
    
    def test_direct_instagram_requests(self, max_requests: int = 50) -> List[TestResult]:
        """
        Test direct requests to Instagram to understand their rate limiting
        """
        logger.info(f"🌐 Testing direct Instagram requests (up to {max_requests})")
        
        results = []
        
        for i in range(1, max_requests + 1):
            test_url = random.choice(self.test_urls)
            
            logger.info(f"📤 Direct request {i}/{max_requests}: {test_url}")
            
            start_time = time.time()
            
            try:
                response = self.session.get(test_url, timeout=10)
                response_time = time.time() - start_time
                
                result = TestResult(
                    timestamp=datetime.now(),
                    request_number=i,
                    success=response.status_code == 200,
                    response_code=response.status_code,
                    response_time=response_time,
                    response_size=len(response.content),
                    response_headers=dict(response.headers)
                )
                
                # Check for Instagram-specific blocking
                if response.status_code == 429:
                    result.rate_limited = True
                    result.error_type = "instagram_rate_limited"
                    
                elif response.status_code == 403:
                    result.blocked = True
                    result.error_type = "instagram_blocked"
                    
                # Check for login redirect or challenge
                if 'login' in response.url.lower() or 'challenge' in response.url.lower():
                    result.captcha_detected = True
                    result.error_type = "login_challenge_redirect"
                    
                results.append(result)
                
                status = "✅ SUCCESS" if result.success else "❌ FAILED"
                logger.info(f"{status} - Code: {result.response_code}, Time: {result.response_time:.2f}s")
                
                if result.captcha_detected or result.blocked:
                    logger.warning("🚫 Instagram blocking detected - stopping direct tests")
                    break
                    
                # Random delay
                time.sleep(random.uniform(2, 8))
                
            except Exception as e:
                result = TestResult(
                    timestamp=datetime.now(),
                    request_number=i,
                    success=False,
                    response_code=0,
                    response_time=time.time() - start_time,
                    error_type=f"request_error: {str(e)}"
                )
                results.append(result)
                logger.error(f"❌ Request failed: {e}")
                
        return results
    
    def analyze_results(self, results: List[TestResult]) -> Dict:
        """
        Analyze test results to determine rate limits and patterns
        """
        if not results:
            return {"error": "No results to analyze"}
            
        total_requests = len(results)
        successful_requests = sum(1 for r in results if r.success)
        rate_limited_requests = sum(1 for r in results if r.rate_limited)
        blocked_requests = sum(1 for r in results if r.blocked)
        captcha_requests = sum(1 for r in results if r.captcha_detected)
        
        # Calculate success rate over time
        success_rate = (successful_requests / total_requests) * 100
        
        # Find when rate limiting started
        first_rate_limit = next((r.request_number for r in results if r.rate_limited), None)
        first_block = next((r.request_number for r in results if r.blocked), None)
        first_captcha = next((r.request_number for r in results if r.captcha_detected), None)
        
        # Calculate average response times
        successful_times = [r.response_time for r in results if r.success and r.response_time > 0]
        avg_response_time = sum(successful_times) / len(successful_times) if successful_times else 0
        
        # Time analysis
        if results:
            test_duration = (results[-1].timestamp - results[0].timestamp).total_seconds()
            requests_per_minute = (total_requests / test_duration) * 60 if test_duration > 0 else 0
        else:
            test_duration = 0
            requests_per_minute = 0
            
        analysis = {
            "summary": {
                "total_requests": total_requests,
                "successful_requests": successful_requests,
                "success_rate_percent": round(success_rate, 2),
                "rate_limited_requests": rate_limited_requests,
                "blocked_requests": blocked_requests,
                "captcha_requests": captcha_requests,
            },
            "rate_limiting": {
                "first_rate_limit_at_request": first_rate_limit,
                "first_block_at_request": first_block,
                "first_captcha_at_request": first_captcha,
                "estimated_safe_request_limit": first_rate_limit - 1 if first_rate_limit else total_requests,
            },
            "performance": {
                "average_response_time_seconds": round(avg_response_time, 2),
                "test_duration_seconds": round(test_duration, 2),
                "requests_per_minute": round(requests_per_minute, 2),
            },
            "recommendations": self._generate_recommendations(results)
        }
        
        return analysis
    
    def _generate_recommendations(self, results: List[TestResult]) -> List[str]:
        """
        Generate recommendations based on test results
        """
        recommendations = []
        
        successful_requests = sum(1 for r in results if r.success)
        rate_limited_requests = sum(1 for r in results if r.rate_limited)
        
        if successful_requests == 0:
            recommendations.append("❌ No successful requests - check API credentials and network connectivity")
            
        elif rate_limited_requests > 0:
            first_rate_limit = next(r.request_number for r in results if r.rate_limited)
            recommendations.append(f"⏰ Rate limiting detected after {first_rate_limit} requests")
            recommendations.append(f"💡 Recommended batch size: {max(1, first_rate_limit - 5)} requests")
            recommendations.append("⏳ Implement delays of 60+ seconds between batches")
            
        else:
            recommendations.append(f"✅ No rate limiting detected up to {len(results)} requests")
            recommendations.append("💡 Consider testing with larger batches")
            
        if any(r.captcha_detected for r in results):
            recommendations.append("🤖 Captcha/challenge detected - consider using residential proxies")
            recommendations.append("🔄 Implement account rotation to avoid detection")
            
        if any(r.blocked for r in results):
            recommendations.append("🚫 Account blocking detected - implement IP rotation")
            recommendations.append("👥 Use multiple accounts to distribute load")
            
        # Performance recommendations
        avg_time = sum(r.response_time for r in results if r.success and r.response_time > 0)
        if avg_time > 0:
            avg_time = avg_time / sum(1 for r in results if r.success and r.response_time > 0)
            if avg_time > 10:
                recommendations.append("🐌 Slow response times detected - consider using faster proxies")
                
        return recommendations
    
    def save_results(self, results: List[TestResult], filename: str = None):
        """
        Save test results to JSON file
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"rate_limit_test_results_{timestamp}.json"
            
        # Convert results to serializable format
        serializable_results = []
        for result in results:
            result_dict = {
                "timestamp": result.timestamp.isoformat(),
                "request_number": result.request_number,
                "success": result.success,
                "response_code": result.response_code,
                "response_time": result.response_time,
                "error_type": result.error_type,
                "captcha_detected": result.captcha_detected,
                "rate_limited": result.rate_limited,
                "blocked": result.blocked,
                "response_size": result.response_size,
                "response_headers": result.response_headers
            }
            serializable_results.append(result_dict)
            
        with open(filename, 'w') as f:
            json.dump(serializable_results, f, indent=2)
            
        logger.info(f"💾 Results saved to {filename}")
        return filename

def main():
    """
    Main function to run rate limiting tests
    """
    print("🚀 Instagram Rate Limiting Test System")
    print("=" * 50)
    
    # Test configuration
    test_account = AccountConfig(
        name="test_account_1",
        apify_token="apify_api_YOUR_TOKEN_HERE",  # Replace with actual token
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    
    tester = InstagramRateLimitTester()
    
    print("📋 Test Plan:")
    print("1. Test Apify API rate limits (up to 100 requests)")
    print("2. Test direct Instagram requests (up to 50 requests)")
    print("3. Analyze results and generate recommendations")
    print()
    
    # Test 1: Apify API Rate Limits
    print("🔍 Phase 1: Testing Apify API Rate Limits...")
    apify_results = tester.test_apify_rate_limits(test_account, max_requests=100)
    
    print("\n📊 Apify Test Results:")
    apify_analysis = tester.analyze_results(apify_results)
    print(json.dumps(apify_analysis, indent=2))
    
    # Test 2: Direct Instagram Requests
    print("\n🔍 Phase 2: Testing Direct Instagram Requests...")
    instagram_results = tester.test_direct_instagram_requests(max_requests=50)
    
    print("\n📊 Instagram Test Results:")
    instagram_analysis = tester.analyze_results(instagram_results)
    print(json.dumps(instagram_analysis, indent=2))
    
    # Save results
    apify_file = tester.save_results(apify_results, "apify_rate_limit_results.json")
    instagram_file = tester.save_results(instagram_results, "instagram_rate_limit_results.json")
    
    print(f"\n💾 Results saved:")
    print(f"   - Apify results: {apify_file}")
    print(f"   - Instagram results: {instagram_file}")
    
    # Generate final recommendations
    print("\n🎯 Final Recommendations:")
    print("=" * 30)
    
    all_recommendations = set()
    all_recommendations.update(apify_analysis.get('recommendations', []))
    all_recommendations.update(instagram_analysis.get('recommendations', []))
    
    for i, rec in enumerate(sorted(all_recommendations), 1):
        print(f"{i}. {rec}")
        
    print("\n✅ Rate limiting test completed!")
    print("📧 Ready to implement multi-account scaling based on these results.")

if __name__ == "__main__":
    main()