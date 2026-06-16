import requests

def test_signup_endpoint():
    url = "http://127.0.0.1:8000/api/auth/signup"
    payload = {
        "email": "test_endpoint@padpick.com",
        "full_name": "Test Endpoint",
        "password": "password123",
        "mobile_number": "1234567890"
    }
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_signup_endpoint()
