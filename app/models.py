from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(20))  # 'student', 'teacher', 'admin'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140))
    description = db.Column(db.String(500))
    image_url = db.Column(db.String(200))

class StudentBehavior(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    study_time = db.Column(db.Integer)  # in minutes
    points = db.Column(db.Integer)
    interaction_count = db.Column(db.Integer)

    user = db.relationship('User', backref='behaviors')

class Resource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140))
    type = db.Column(db.String(50)) # 'video', 'pdf', etc.
    url = db.Column(db.String(200))
    description = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140))
    description = db.Column(db.String(500))
    deadline = db.Column(db.DateTime)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignment.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    score = db.Column(db.Float)
    feedback = db.Column(db.String(500))
    submitted_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class ForumPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140))
    content = db.Column(db.Text)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    likes = db.Column(db.Integer, default=0)

    author = db.relationship('User', backref='posts')
