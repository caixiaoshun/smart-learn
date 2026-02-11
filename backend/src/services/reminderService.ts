import cron from 'node-cron';
import { prisma } from '../index';
import { sendHomeworkReminderEmail } from '../utils/email';

// 检查并发送作业提醒
export const checkAndSendReminders = async () => {
  try {
    const now = new Date();

    // 查找需要发送提醒的作业
    // 条件：设置了提醒时间、提醒时间已过、尚未发送提醒、截止时间未到
    const homeworks = await prisma.homework.findMany({
      where: {
        reminderTime: { lte: now },
        reminderSent: false,
        deadline: { gt: now },
      },
      include: {
        class: {
          include: {
            students: {
              include: {
                student: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        submissions: {
          select: { studentId: true },
        },
      },
    });

    console.log(`[${new Date().toISOString()}] 找到 ${homeworks.length} 个需要发送提醒的作业`);

    for (const homework of homeworks) {
      // 获取未提交的学生
      const submittedStudentIds = new Set(homework.submissions.map(s => s.studentId));
      const notSubmittedStudents = homework.class.students
        .map(s => s.student)
        .filter(student => !submittedStudentIds.has(student.id));

      console.log(`作业 "${homework.title}" 有 ${notSubmittedStudents.length} 名学生未提交`);

      // 发送提醒邮件
      let sentCount = 0;
      for (const student of notSubmittedStudents) {
        try {
          await sendHomeworkReminderEmail(
            student.email,
            student.name,
            homework.title,
            homework.deadline,
            homework.class.name
          );
          sentCount++;
          // 避免发送过快
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`发送提醒邮件给 ${student.email} 失败:`, error);
        }
      }

      // 标记已发送提醒
      await prisma.homework.update({
        where: { id: homework.id },
        data: { reminderSent: true },
      });

      console.log(`作业 "${homework.title}" 提醒发送完成: ${sentCount}/${notSubmittedStudents.length}`);
    }
  } catch (error) {
    console.error('检查并发送提醒失败:', error);
  }
};

// 启动定时任务 - 每5分钟检查一次
export const startReminderJob = () => {
  console.log('启动作业提醒定时任务...');

  // 使用 cron 表达式: 每5分钟执行一次
  cron.schedule('*/5 * * * *', () => {
    console.log('执行作业提醒检查...');
    checkAndSendReminders();
  });

  // 立即执行一次
  checkAndSendReminders();
};
