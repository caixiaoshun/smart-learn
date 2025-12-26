from app import create_app, db
from app.models import User, Course, Resource, Assignment, StudentBehavior, ForumPost
from datetime import datetime, timedelta
import random

app = create_app()

def seed_data():
    with app.app_context():
        print("Cleaning up database...")
        db.drop_all()
        db.create_all()

        print("Seeding Users...")
        # Admin/Teacher
        teacher = User(username="teacher_li", email="li@edu.com", role="teacher")
        teacher.set_password("123456")
        db.session.add(teacher)

        # Specific Students for Demo Scenarios
        # 1. High Risk Student (Points < 300)
        s1 = User(username="张伟", email="zhangwei@edu.com", role="student")
        s1.set_password("123456")
        db.session.add(s1)

        # 2. Medium Risk Student (300 <= Points < 600)
        s2 = User(username="李娜", email="lina@edu.com", role="student")
        s2.set_password("123456")
        db.session.add(s2)

        # 3. Low Risk / High Performance Student (Points >= 600)
        s3 = User(username="王强", email="wangqiang@edu.com", role="student")
        s3.set_password("123456")
        db.session.add(s3)

        # General Students
        general_students = []
        for i in range(1, 6):
            s = User(username=f"student_{i}", email=f"student{i}@edu.com", role="student")
            s.set_password("123456")
            general_students.append(s)
            db.session.add(s)

        db.session.commit()

        # Group all students for easier iteration
        all_students = [s1, s2, s3] + general_students

        print("Seeding Courses & Resources...")
        course = Course(title="数据挖掘导论", description="深入理解数据挖掘算法与应用", image_url="")
        db.session.add(course)
        db.session.commit()

        resources = [
            Resource(title="关联规则挖掘基础", type="video", url="#", description="Apriori 算法详解"),
            Resource(title="K-Means 聚类演示", type="interactive", url="#", description="交互式算法演示"),
            Resource(title="决策树实验指南", type="pdf", url="#", description="实验步骤与代码框架"),
            Resource(title="中医药案例数据", type="dataset", url="#", description="脱敏处理后的真实数据集"),
        ]
        for r in resources:
            db.session.add(r)

        print("Seeding Assignments...")
        assignments = [
            Assignment(title="第一次作业：数据预处理", description="完成缺失值填充", deadline=datetime.now() + timedelta(days=5), course_id=course.id, created_by=teacher.id),
            Assignment(title="第二次作业：分类算法", description="实现 KNN", deadline=datetime.now() + timedelta(days=12), course_id=course.id, created_by=teacher.id),
        ]
        for a in assignments:
            db.session.add(a)
        db.session.commit()

        print("Seeding Student Data...")

        # 1. Zhang Wei (High Risk)
        b1 = StudentBehavior(user_id=s1.id, study_time=200, points=250, interaction_count=5)
        db.session.add(b1)

        # 2. Li Na (Medium Risk)
        b2 = StudentBehavior(user_id=s2.id, study_time=600, points=550, interaction_count=15)
        db.session.add(b2)

        # 3. Wang Qiang (High Performance)
        b3 = StudentBehavior(user_id=s3.id, study_time=1500, points=1200, interaction_count=40)
        db.session.add(b3)

        # Random data for others
        for s in general_students:
            behavior = StudentBehavior(
                user_id=s.id,
                study_time=random.randint(10, 1200),
                points=random.randint(100, 1500),
                interaction_count=random.randint(0, 50)
            )
            db.session.add(behavior)

            if random.random() > 0.7:
                post = ForumPost(
                    title=f"关于作业 {random.randint(1,2)} 的问题",
                    content="我在实现算法时遇到了收敛问题，请教各位...",
                    author_id=s.id,
                    likes=random.randint(0, 20)
                )
                db.session.add(post)

        db.session.commit()
        print("Database seeded successfully with Demo Accounts!")

if __name__ == "__main__":
    seed_data()
