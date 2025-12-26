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
        teacher.set_password("password")
        db.session.add(teacher)

        # Students
        students = []
        for i in range(1, 11):
            s = User(username=f"student_{i}", email=f"student{i}@edu.com", role="student")
            s.set_password("password")
            students.append(s)
            db.session.add(s)

        db.session.commit()

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
        for s in students:
            # Behaviors
            behavior = StudentBehavior(
                user_id=s.id,
                study_time=random.randint(10, 1200),
                points=random.randint(100, 1500),
                interaction_count=random.randint(0, 50)
            )
            db.session.add(behavior)

            # Forum Posts
            if random.random() > 0.7:
                post = ForumPost(
                    title=f"关于作业 {random.randint(1,2)} 的问题",
                    content="我在实现算法时遇到了收敛问题，请教各位...",
                    author_id=s.id,
                    likes=random.randint(0, 20)
                )
                db.session.add(post)

        db.session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    seed_data()
