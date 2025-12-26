import unittest
from app import create_app, db
from app.models import User

class BasicTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(config_class='config.Config')
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
        self.app.config['WTF_CSRF_ENABLED'] = False

        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_index_redirect(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)

    def test_login_page_loads(self):
        response = self.client.get('/auth/login')
        self.assertEqual(response.status_code, 200)
        # Check for Chinese title "用户登录" encoded in utf-8
        self.assertIn('用户登录'.encode('utf-8'), response.data)

    def test_register_page_loads(self):
        response = self.client.get('/auth/register')
        self.assertEqual(response.status_code, 200)
        # Check for Chinese title "用户注册"
        self.assertIn('用户注册'.encode('utf-8'), response.data)

if __name__ == '__main__':
    unittest.main()
