import unittest
from app import create_app, db
from app.models import User
import json

class AIChatTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['WTF_CSRF_ENABLED'] = False  # Disable CSRF for testing convenience
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create user
        u = User(username='test_ai_user', email='ai@test.com', role='student')
        u.set_password('password')
        db.session.add(u)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_ai_chat_mock(self):
        # Login
        # Note: Since WTF_CSRF_ENABLED is False, we don't need a token,
        # but we do need to ensure the login persists.
        # Using follow_redirects=True is good.
        login_response = self.client.post('/auth/login', data={
            'username': 'test_ai_user',
            'password': 'password'
        }, follow_redirects=True)

        # Verify login was successful (should be on course_home or similar, status 200)
        self.assertEqual(login_response.status_code, 200)

        # Send chat message
        response = self.client.post('/api/chat',
                                    data=json.dumps({'message': 'Hello AI'}),
                                    content_type='application/json')

        # If 302, print where it's redirecting to help debug
        if response.status_code == 302:
            print(f"Redirecting to: {response.headers.get('Location')}")

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('reply', data)
        self.assertTrue(len(data['reply']) > 0)
