import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useGroupStore } from '@/stores/groupStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Copy,
  Star,
  LogOut,
  UserMinus,
  Crown,
  Send,
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle2,
  Lock,
  Upload,
  FileText,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { LaborDivisionItem } from '@/types';

export function GroupFormationPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    myGroupStatus,
    messages,
    isLoading,
    messagesLoading,
    fetchMyGroup,
    createGroup,
    joinGroupByCode,
    leaveGroup,
    removeMember,
    transferLeader,
    dissolveGroup,
    submitGroupWork,
    fetchMessages,
    sendMessage,
  } = useGroupStore();

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submission state
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [laborDivision, setLaborDivision] = useState<LaborDivisionItem[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Dissolve state
  const [dissolveLoading, setDissolveLoading] = useState(false);

  useEffect(() => {
    if (homeworkId) {
      fetchMyGroup(homeworkId);
    }
  }, [homeworkId]);

  // Load messages when group is available
  useEffect(() => {
    if (myGroupStatus?.myGroup) {
      fetchMessages(myGroupStatus.myGroup.id);
      // Poll for new messages every 10 seconds
      pollRef.current = setInterval(() => {
        fetchMessages(myGroupStatus.myGroup!.id);
      }, 10000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [myGroupStatus?.myGroup?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Countdown timer
  useEffect(() => {
    const deadline = myGroupStatus?.groupConfig?.groupDeadline;
    if (!deadline) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(deadline).getTime();
      const diff = Math.max(0, end - now);

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [myGroupStatus?.groupConfig?.groupDeadline]);

  const handleCreateGroup = async () => {
    if (!homeworkId || !newGroupName.trim()) return;
    setCreateLoading(true);
    try {
      await createGroup(homeworkId, newGroupName.trim());
      setNewGroupName('');
      setShowJoinDialog(false);
      await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCodeInput.trim()) return;
    setJoinLoading(true);
    try {
      await joinGroupByCode(inviteCodeInput.trim().toUpperCase());
      setInviteCodeInput('');
      setShowJoinDialog(false);
      if (homeworkId) await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!myGroupStatus?.myGroup) return;
    try {
      await leaveGroup(myGroupStatus.myGroup.id);
      if (homeworkId) await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!myGroupStatus?.myGroup) return;
    try {
      await removeMember(myGroupStatus.myGroup.id, studentId);
      if (homeworkId) await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    }
  };

  const handleTransferLeader = async (newLeaderId: string) => {
    if (!myGroupStatus?.myGroup) return;
    try {
      await transferLeader(myGroupStatus.myGroup.id, newLeaderId);
      if (homeworkId) await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    }
  };

  const handleSendMessage = async () => {
    if (!myGroupStatus?.myGroup || !messageInput.trim()) return;
    try {
      await sendMessage(myGroupStatus.myGroup.id, messageInput.trim());
      setMessageInput('');
    } catch {
      // error handled by interceptor
    }
  };

  const handleCopyInviteCode = () => {
    if (!myGroupStatus?.myGroup?.inviteCode) return;
    navigator.clipboard.writeText(myGroupStatus.myGroup.inviteCode);
    toast.success('邀请码已复制到剪贴板');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDissolveGroup = async () => {
    if (!myGroupStatus?.myGroup) return;
    if (!confirm('确定要解散队伍吗？所有成员将被移出，此操作不可撤销。')) return;
    setDissolveLoading(true);
    try {
      await dissolveGroup(myGroupStatus.myGroup.id);
      if (homeworkId) await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    } finally {
      setDissolveLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext === 'pdf' || ext === 'ipynb';
    });
    if (validFiles.length !== files.length) {
      toast.error('只允许上传 PDF 或 Jupyter Notebook (.ipynb) 文件');
    }
    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openSubmitDialog = () => {
    if (!myGroupStatus?.myGroup) return;
    const members = myGroupStatus.myGroup.members;
    // Evenly distribute contribution percentages, assign remainder to first member to ensure sum is exactly 100%
    const avgPercent = Math.floor(100 / members.length);
    const remainder = 100 - avgPercent * members.length;
    setLaborDivision(
      members.map((m, i) => ({
        memberId: m.studentId,
        memberName: m.student.name,
        task: '',
        contributionPercent: avgPercent + (i === 0 ? remainder : 0),
      }))
    );
    setSelectedFiles([]);
    setShowSubmitDialog(true);
  };

  const updateLaborItem = (index: number, field: keyof LaborDivisionItem, value: string | number) => {
    setLaborDivision(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmitGroupWork = async () => {
    if (!myGroupStatus?.myGroup || !homeworkId) return;
    if (selectedFiles.length === 0) {
      toast.error('请上传至少一个文件');
      return;
    }
    const emptyTasks = laborDivision.filter(d => !d.task.trim());
    if (emptyTasks.length > 0) {
      toast.error('请为每位成员填写任务分工');
      return;
    }
    const totalPercent = laborDivision.reduce((sum, d) => sum + d.contributionPercent, 0);
    if (totalPercent !== 100) {
      toast.error(`贡献比例合计应为 100%，当前为 ${totalPercent}%`);
      return;
    }
    setSubmitLoading(true);
    try {
      await submitGroupWork(myGroupStatus.myGroup.id, homeworkId, selectedFiles, laborDivision);
      setShowSubmitDialog(false);
      setSelectedFiles([]);
      if (homeworkId) await fetchMyGroup(homeworkId);
    } catch {
      // error handled by interceptor
    } finally {
      setSubmitLoading(false);
    }
  };

  if (isLoading && !myGroupStatus) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const myGroup = myGroupStatus?.myGroup;
  const groupConfig = myGroupStatus?.groupConfig || {};
  const stats = myGroupStatus?.stats || { totalStudents: 0, assignedCount: 0 };
  const homeworkInfo = myGroupStatus?.homework;
  const isLeader = myGroup?.leaderId === user?.id;
  const maxSize = groupConfig.maxSize || 6;
  const memberCount = myGroup?.members?.length || 0;
  const isGroupFull = memberCount >= maxSize;
  const progressPercent = stats.totalStudents > 0 ? Math.round((stats.assignedCount / stats.totalStudents) * 100) : 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/homeworks')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => navigate('/homeworks')}>
              我的作业
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-medium">{homeworkInfo?.title || '组队中心'}</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {myGroup?.status === 'FORMING' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              组队进行中
            </div>
          )}
          {myGroup?.status === 'LOCKED' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-sm font-medium">
              <Lock className="w-3.5 h-3.5" />
              已锁定
            </div>
          )}
          {myGroup?.status === 'SUBMITTED' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-sm font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已提交
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-6">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-2">
            {/* Countdown & Deadline Card */}
            {groupConfig.groupDeadline && (
              <Card className="border-slate-100 shadow-sm">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold mb-1">组队截止倒计时</h2>
                  <p className="text-xs text-slate-500 mb-4">
                    截止时间: {new Date(groupConfig.groupDeadline).toLocaleString('zh-CN')}
                  </p>
                  <div className="flex justify-between items-center gap-2 mb-4">
                    {[
                      { value: countdown.days, label: '天' },
                      { value: countdown.hours, label: '时' },
                      { value: countdown.minutes, label: '分' },
                    ].map((item, i) => (
                      <div key={item.label} className="contents">
                        {i > 0 && <span className="text-slate-300 text-xl font-bold">:</span>}
                        <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg flex-1">
                          <span className="text-2xl font-bold text-blue-600">
                            {String(item.value).padStart(2, '0')}
                          </span>
                          <span className="text-xs text-slate-500">{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>已组队: {stats.assignedCount}人</span>
                    <span>总人数: {stats.totalStudents}人</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No group - Show join/create dialog */}
            {!myGroup && (
              <Card className="border-slate-100 shadow-sm flex-1 flex flex-col items-center justify-center">
                <CardContent className="p-8 text-center space-y-4">
                  <Users className="w-16 h-16 text-slate-300 mx-auto" />
                  <h3 className="text-xl font-bold">加入或创建小组</h3>
                  <p className="text-slate-500 text-sm">你还没有加入任何项目小组，请选择操作</p>
                  <div className="space-y-4 w-full max-w-sm mx-auto">
                    <Button
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
                      onClick={() => setShowJoinDialog(true)}
                    >
                      <Plus className="w-4 h-4" />
                      创建新小组
                    </Button>
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-200" />
                      <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">或者使用邀请码</span>
                      <div className="flex-grow border-t border-slate-200" />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入邀请码 (如: SL-XXXX)"
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={handleJoinByCode}
                        disabled={!inviteCodeInput.trim() || joinLoading}
                      >
                        {joinLoading ? '加入中...' : '加入'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* My Group Status Card */}
            {myGroup && (
              <Card className="border-slate-100 shadow-sm flex-1 flex flex-col">
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        我的小组
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">{myGroup.name}</p>
                    </div>
                    <Badge
                      className={
                        isGroupFull
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-green-100 text-green-700 border-green-200'
                      }
                    >
                      {isGroupFull ? '成员已满' : '成员未满'}
                    </Badge>
                  </div>

                  {/* Invite Code */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 relative overflow-hidden">
                    <div className="absolute right-2 top-2 opacity-10 pointer-events-none">
                      <Users className="w-16 h-16" />
                    </div>
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">小组邀请码</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-mono font-bold text-blue-600 tracking-widest">
                        {myGroup.inviteCode}
                      </span>
                      <button
                        onClick={handleCopyInviteCode}
                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-white/50 transition-colors"
                        title="复制邀请码"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-blue-500/70 mt-2">分享给同学加入小组</p>
                  </div>

                  {/* Member Count */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-sm">
                      小组成员 ({memberCount}/{maxSize})
                    </h3>
                  </div>

                  {/* Member List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {myGroup.members.map((member) => {
                      const isSelf = member.studentId === user?.id;
                      const isMemberLeader = member.role === 'LEADER';
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center p-3 rounded-lg border transition-colors group ${
                            isMemberLeader
                              ? 'border-blue-300/30 bg-blue-500/5'
                              : 'border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={member.student.avatar || undefined} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                                {member.student.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {isMemberLeader && (
                              <div
                                className="absolute -bottom-1 -right-1 bg-yellow-400 text-white rounded-full p-[2px] border-2 border-white flex items-center justify-center"
                                title="组长"
                              >
                                <Star className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-semibold">
                              {member.student.name}
                              {isSelf && ' (我)'}
                            </p>
                            <p className="text-xs text-slate-500">{member.student.email}</p>
                          </div>
                          {isMemberLeader && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5">组长</Badge>
                          )}
                          {/* Admin actions (only show for leader on non-self members) */}
                          {isLeader && !isSelf && myGroup.status === 'FORMING' && (
                            <div className="hidden group-hover:flex gap-1 ml-2">
                              <button
                                onClick={() => handleRemoveMember(member.studentId)}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                title="踢出成员"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleTransferLeader(member.studentId)}
                                className="p-1.5 text-slate-400 hover:text-blue-500 rounded hover:bg-blue-50 transition-colors"
                                title="转让组长"
                              >
                                <Crown className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Empty slots */}
                    {Array.from({ length: Math.max(0, maxSize - memberCount) }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="flex items-center justify-center p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400"
                      >
                        <span className="text-xs flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          待加入成员
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {/* Submit button - only for leader when group is FORMING or LOCKED */}
                    {isLeader && myGroup.status !== 'SUBMITTED' && (
                      <Button
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                        onClick={openSubmitDialog}
                      >
                        <Upload className="w-4 h-4" />
                        提交小组作业
                      </Button>
                    )}
                    {myGroup.status === 'FORMING' && (
                      <div className="grid grid-cols-1 gap-3">
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                          onClick={handleLeaveGroup}
                        >
                          <LogOut className="w-4 h-4" />
                          退出小组
                        </Button>
                        {isLeader && (
                          <Button
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                            onClick={handleDissolveGroup}
                            disabled={dissolveLoading}
                          >
                            <AlertTriangle className="w-4 h-4" />
                            {dissolveLoading ? '解散中...' : '解散队伍'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Chat */}
          <div className="lg:col-span-8 h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {myGroup ? (
              <>
                {/* Chat Header */}
                <div className="h-16 border-b border-slate-100 px-6 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="font-bold text-lg">组内讨论区</h2>
                    <p className="text-xs text-slate-500">在此快速沟通任务分配与进度</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {myGroup.members.slice(0, 5).map((m) => (
                        <Avatar key={m.id} className="w-8 h-8 border-2 border-white">
                          <AvatarImage src={m.student.avatar || undefined} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {m.student.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <ScrollArea className="flex-1 p-6 bg-slate-50/50">
                  <div className="space-y-6">
                    {messagesLoading && messages.length === 0 ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无消息，发送第一条消息开始讨论吧</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        if (msg.type === 'SYSTEM') {
                          return (
                            <div key={msg.id} className="flex justify-center">
                              <span className="bg-slate-200 text-slate-500 text-xs px-3 py-1 rounded-full">
                                {msg.content} -{' '}
                                {new Date(msg.createdAt).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          );
                        }

                        const isMe = msg.senderId === user?.id;
                        return (
                          <div key={msg.id} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <Avatar className="w-10 h-10 mt-1">
                              <AvatarImage src={msg.sender.avatar || undefined} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                                {msg.sender.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`max-w-[80%] ${isMe ? 'flex flex-col items-end' : ''}`}>
                              <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <span className="font-semibold text-sm">
                                  {isMe ? '我' : msg.sender.name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {new Date(msg.createdAt).toLocaleTimeString('zh-CN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div
                                className={`p-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                  isMe
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-white border border-slate-100 rounded-tl-none'
                                }`}
                              >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Chat Input */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                  <div className="relative">
                    <Textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="按 Enter 发送消息，Shift + Enter 换行..."
                      className="w-full bg-slate-50 border-none rounded-xl p-4 pr-14 text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <Button
                      size="sm"
                      className="absolute bottom-3 right-3 bg-blue-600 hover:bg-blue-700 p-2 rounded-lg shadow-sm"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Users className="w-20 h-20 mb-4 opacity-30" />
                <p className="text-lg font-medium text-slate-500">加入小组后即可使用讨论区</p>
                <p className="text-sm mt-1">请先创建或加入一个小组</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create/Join Group Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">创建新小组</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">小组名称</label>
              <Input
                placeholder="例如：Web项目攻坚队"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={50}
                className="text-sm"
              />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || createLoading}
            >
              {createLoading ? '创建中...' : '创建小组'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit Group Work Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">提交小组作业</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {/* File Upload */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">上传文件</label>
              <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group bg-slate-50/50">
                <input
                  type="file"
                  id="group-submit-files"
                  multiple
                  accept=".pdf,.ipynb"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="group-submit-files" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-10 h-10 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-blue-600">点击上传</span>
                  <span className="text-xs text-slate-400 mt-1">支持 PDF、Jupyter Notebook (.ipynb)，最多5个文件</span>
                </label>
              </div>
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-sm font-medium text-slate-700">{file.name}</span>
                          <span className="text-xs text-slate-400 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="flex-shrink-0 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Labor Division */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">分工说明</label>
              <p className="text-xs text-slate-500">请为每位成员填写任务分工和贡献百分比（合计 100%）</p>
              <div className="space-y-3">
                {laborDivision.map((item, index) => (
                  <div key={item.memberId} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                          {item.memberName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold text-slate-700">{item.memberName}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_100px] gap-3">
                      <Input
                        placeholder="负责的任务（如：前端开发、数据分析）"
                        value={item.task}
                        onChange={(e) => updateLaborItem(index, 'task', e.target.value)}
                        className="text-sm"
                      />
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.contributionPercent}
                          onChange={(e) => updateLaborItem(index, 'contributionPercent', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          className="text-sm pr-7"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right text-sm">
                贡献比例合计：
                <span className={`font-bold ${laborDivision.reduce((s, d) => s + d.contributionPercent, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {laborDivision.reduce((s, d) => s + d.contributionPercent, 0)}%
                </span>
              </div>
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 gap-2"
              onClick={handleSubmitGroupWork}
              disabled={submitLoading || selectedFiles.length === 0}
            >
              <Send className="w-4 h-4" />
              {submitLoading ? '提交中...' : '提交作业'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
