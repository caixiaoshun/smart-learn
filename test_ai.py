import requests

def test_chat_api():
    # Simulate a logged-in user session if needed, or just test the logic locally if possible.
    # However, since we need login, we can't easily curl without session cookie.
    # Instead, we will rely on unit tests or manual verification via the browser.
    # But wait, I can use the python requests session if I log in first.

    s = requests.Session()
    # 1. Login
    login_data = {'username': 'testuser', 'password': 'password'}
    # First, register the user to ensure they exist
    s.post('http://127.0.0.1:5000/register', data={'username': 'testuser', 'email': 'test@example.com', 'password': 'password', 'confirm_password': 'password', 'terms': 'on'})

    # Then login
    login_response = s.post('http://127.0.0.1:5000/login', data=login_data)

    # 2. Test Chat API
    chat_data = {'message': '你好，我需要关于干预的建议'}
    response = s.post('http://127.0.0.1:5000/api/chat', json=chat_data)

    if response.status_code == 200:
        print("Chat API Response:", response.json())
    else:
        print("Chat API Failed:", response.status_code, response.text)

if __name__ == "__main__":
    test_chat_api()
