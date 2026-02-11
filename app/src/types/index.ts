// 用户角色
export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

// 用户基础信息
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  bio?: string | null;
  preferences?: UserPreferences | null;
  classes?: {
    id: string;
    name: string;
  }[];
}

// 用户偏好设置
export interface UserPreferences {
  system_notification?: boolean;
  course_notification?: boolean;
  points_notification?: boolean;
  ai_notification?: boolean;
  public_progress?: boolean;
  public_case_lib?: boolean;
}

// 学生资料
export interface StudentProfile {
  id: string;
  userId: string;
  studentId: string;
  major?: string;
  grade?: string;
  bio?: string;
  totalPoints: number;
  rank?: string;
  publicProgress: boolean;
  publicCaseLib: boolean;
  notifySystem: boolean;
  notifyCourse: boolean;
  notifyPoints: boolean;
  notifyAI: boolean;
}

// 教师资料
export interface TeacherProfile {
  id: string;
  userId: string;
  teacherId: string;
  department?: string;
  title?: string;
}

// 模块状态
export type ModuleStatus = 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';

// 课程模块
export interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  status: ModuleStatus;
  videos: Video[];
  quizzes: Quiz[];
}

// 视频
export interface Video {
  id: string;
  title: string;
  duration: number;
  url: string;
}

// 测验
export interface Quiz {
  id: string;
  title: string;
  questions: any[];
}

// 课程公告
export interface CourseAnnouncement {
  id: string;
  title: string;
  detail: string;
  type: 'deadline' | 'new';
}

// 课程
export interface Course {
  id: string;
  code: string;
  name: string;
  description: string;
  instructor: string;
  semester: string;
  coverImage?: string;
  progress: number;
  modules: Module[];
  announcements?: CourseAnnouncement[];
}

// 案例难度
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// 案例
export interface Case {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  theme: string[];
  tags: string[];
  difficulty: Difficulty;
  duration: number;
  rating: number;
  views: number;
  codeExample?: string;
  resources?: any;
}

// 资源类型
export type ResourceType = 'VIDEO' | 'DEMONSTRATION' | 'NOTEBOOK' | 'CASE' | 'HOMEWORK';

// 资源
export interface Resource {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  thumbnail?: string;
  url: string;
  filePath?: string;
  points: number;
  tags: string[];
  duration?: string;
  author?: string;
  views?: number;
  category?: string;
  createdAt?: string;
}

// 学习记录类型
export type RecordType = 'QUIZ' | 'EXPERIMENT' | 'DISCUSSION' | 'PROJECT';

// 学习记录
export interface LearningRecord {
  id: string;
  type: RecordType;
  title: string;
  score?: number;
  duration?: number;
  createdAt: string;
}

// 积分记录
export interface PointsRecord {
  id: string;
  points: number;
  reason: string;
  type: 'EARN' | 'SPEND';
  createdAt: string;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  content: string;
  isAI: boolean;
  createdAt: string;
}

// 聊天会话
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// 仪表盘统计
export interface DashboardStats {
  totalPoints: number;
  maxPoints: number;
  rank: string;
  courseProgress: number;
  aiInteractionScore: number;
  weeklyPointsEarned: number;
  rankChange: number;
  interactionLevel: string;
}

// 学习趋势数据
export interface LearningTrendData {
  labels: string[];
  data: number[];
}

// AI 诊断数据
export interface AIDiagnosis {
  summary: string;
  suggestion: string;
}

// 能力雷达数据
export interface AbilityRadarData {
  labels: string[];
  data: number[];
  fullMark: number;
  aiDiagnosis?: AIDiagnosis;
}

// 学习模块数据
export interface ModulesData {
  quiz: {
    level: string;
    avgRate: number;
    completed: number;
    total: number;
  };
  lab: {
    status: string;
    currentTitle: string;
    progress: number;
    passed: number;
    total: number;
    codeQuality: string;
  };
  discussion: {
    points: number;
    weeklyData: number[];
    thisWeekPosts: number;
    totalPosts: number;
  };
  groupProject: {
    members: { name: string; avatar: string }[];
    extraMembers: number;
    projectName: string;
    daysLeft: number;
  };
}

// 聊天历史条目
export interface ChatHistoryItem {
  id: string;
  title: string;
  time: string;
  createdAt: string;
}

// 活动
export interface Activity {
  id: string;
  title: string;
  description: string;
  points: number;
  createdAt: string;
}

// 学生行为数据
export interface StudentBehavior {
  id: string;
  studentId: string;
  studentName: string;
  avatar?: string;
  quizAvg: number;
  codingHours: number;
  discussionPosts: number;
  lastActive: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

// 干预
export interface Intervention {
  id: string;
  studentId: string;
  studentName: string;
  avatar?: string;
  behaviorScore: number;
  currentPoints: number;
  aiRecommendation: string;
  type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
}

// 评论
export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  role?: string;
  content: string;
  createdAt: string;
}

// ========== 作业形态与动态组队 ==========

// 作业形态
export type HomeworkType = 'STANDARD' | 'GROUP_PROJECT' | 'SELF_PRACTICE';

// 组队配置
export interface GroupConfig {
  groupRequired?: boolean;     // 是否必须组队
  minSize?: number;            // 最小人数 (默认2)
  maxSize?: number;            // 最大人数 (默认6)
  groupDeadline?: string;      // 组队截止时间
  allowSwitch?: boolean;       // 是否允许换组/退组
  allowTeacherAssign?: boolean; // 是否允许教师指派
  lockTime?: string;           // 锁组时间点
  ungroupedPolicy?: 'AUTO_ASSIGN' | 'TEACHER_ASSIGN' | 'ALLOW_SOLO'; // 未组队兜底策略
  scoringModel?: 'BASE_PLUS_ADJUST' | 'INDIVIDUAL' | 'UNIFORM'; // 成绩模型
}

// 互评配置
export interface PeerReviewConfig {
  reviewersPerSubmission?: number; // 每份作业分配N个评审 (默认3)
  reviewDeadline?: string;         // 互评截止时间
  penaltyLevel?: 'LIGHT' | 'MEDIUM' | 'HEAVY'; // 惩罚等级
  anonymousMode?: 'DOUBLE_BLIND' | 'SINGLE_BLIND' | 'OPEN'; // 匿名模式
  minReviewsRequired?: number;     // 每人最少完成M个评审
  coverageStrategy?: 'AUTO_SUPPLEMENT' | 'TEACHER_ASSIGN' | 'FORCE_TODO'; // 覆盖率保障
}

// 自主实践配置
export interface SelfPracticeConfig {
  bonusCap?: number;            // 加分上限
  countLimit?: number;          // 提交次数上限
  qualityThreshold?: number;    // 质量门槛分
  scoringStrategy?: 'BONUS' | 'POINTS_ONLY' | 'REPLACE_LOWEST'; // 计分策略
  antiCheatRules?: string[];    // 防刷机制描述
}

// 作业小组
export interface AssignmentGroup {
  id: string;
  homeworkId: string;
  name: string;
  inviteCode: string;
  leaderId: string;
  status: 'FORMING' | 'LOCKED' | 'SUBMITTED';
  leader: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  members: AssignmentGroupMember[];
  _count?: {
    members: number;
  };
  createdAt: string;
}

// 小组成员
export interface AssignmentGroupMember {
  id: string;
  groupId: string;
  studentId: string;
  role: 'LEADER' | 'MEMBER';
  student: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  joinedAt: string;
}

// 小组消息
export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'SYSTEM';
  sender: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
}

// 分工说明
export interface LaborDivisionItem {
  memberId: string;
  memberName: string;
  task: string;
  contributionPercent: number;
  description?: string;
}

// 成绩调整
export interface ScoreAdjustment {
  id: string;
  submissionId: string;
  studentId: string;
  baseScore: number;
  adjustScore: number;
  finalScore: number;
  reason?: string;
}

// ========== 自评与互评 ==========

// 自评
export interface SelfAssessment {
  id: string;
  homeworkId: string;
  studentId: string;
  score: number;
  description: string;
  student?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
}

// 互评分配任务
export interface PeerReviewTask {
  id: string;
  homeworkId: string;
  reviewerId: string;
  submissionId: string;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  deadline: string;
  homework: {
    id: string;
    title: string;
    maxScore: number;
    deadline: string;
  };
  submission: {
    id: string;
    files: string[];
    laborDivision?: LaborDivisionItem[];
    submittedAt: string;
  };
}

// 互评记录
export interface PeerReview {
  id: string;
  score: number;
  comment?: string;
  anonymousLabel: string;
  flag: 'NORMAL' | 'FLAGGED' | 'ARBITRATED';
  createdAt: string;
  reviewer?: {
    id: string;
    name: string;
    email: string;
  };
}

// ========== 平时表现 ==========

// 平时表现类型
export type PerformanceType = 'CLASSROOM_QA' | 'KNOWLEDGE_SHARE';

// 平时表现记录
export interface ClassPerformanceRecord {
  id: string;
  classId: string;
  studentId: string;
  type: PerformanceType;
  topic?: string;
  score?: number;
  notes?: string;
  evidence?: string;
  duration?: number;
  occurredAt: string;
  createdAt: string;
  student: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  recordedBy?: {
    id: string;
    name: string;
  };
}

// 平时表现统计
export interface PerformanceSummary {
  student: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  qaCount: number;
  qaAvgScore: number;
  shareCount: number;
  shareAvgScore: number;
  totalRecords: number;
  compositeScore: number;
}

// 知识点
export interface KnowledgePoint {
  id: string;
  classId: string;
  title: string;
  description?: string;
  orderIndex: number;
  _count?: {
    assessments: number;
  };
  assessments?: KnowledgePointAssessment[];
}

// 知识点自评
export interface KnowledgePointAssessment {
  knowledgePointId: string;
  studentId: string;
  masteryLevel: number; // 1-5: 完全不了解/初步了解/基本掌握/熟练运用/融会贯通
  selfNote?: string;
  student?: {
    id: string;
    name: string;
    email: string;
  };
}

// 知识点分布
export interface KnowledgeDistribution {
  id: string;
  title: string;
  description?: string;
  totalAssessments: number;
  averageLevel: number;
  levelDistribution: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    level5: number;
  };
  assessments: Array<{
    student: { id: string; name: string; email: string };
    masteryLevel: number;
    selfNote?: string;
  }>;
}
