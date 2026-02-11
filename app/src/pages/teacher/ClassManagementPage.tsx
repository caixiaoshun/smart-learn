import { useEffect, useMemo, useState } from 'react';
import { useClassStore, type Class } from '@/stores/classStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Copy, Edit2, GraduationCap, Plus, Trash2, UserMinus, Users, BookOpen, RefreshCw } from 'lucide-react';

export function ClassManagementPage() {
  const { classes, isLoading, fetchTeacherClasses, createClass, updateClass, deleteClass, fetchClassDetail, removeStudent } = useClassStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [editClassDesc, setEditClassDesc] = useState('');

  useEffect(() => {
    fetchTeacherClasses();
  }, []);

  const classStats = useMemo(() => {
    const totalStudents = classes.reduce((sum, item) => sum + (item._count?.students || 0), 0);
    return { totalStudents, totalClasses: classes.length };
  }, [classes]);

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    await createClass({ name: newClassName.trim(), description: newClassDesc.trim() || undefined });
    setIsCreateDialogOpen(false);
    setNewClassName('');
    setNewClassDesc('');
  };

  const handleUpdateClass = async () => {
    if (!selectedClass || !editClassName.trim()) return;
    await updateClass(selectedClass.id, { name: editClassName.trim(), description: editClassDesc.trim() });
    setIsEditDialogOpen(false);
    setSelectedClass(null);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('确定要删除这个班级吗？此操作不可恢复。')) return;
    await deleteClass(classId);
  };

  const handleRemoveStudent = async (classId: string, studentId: string, studentName: string) => {
    if (!confirm(`确定要将 ${studentName} 从班级中移除吗？`)) return;
    await removeStudent(classId, studentId);
    await fetchClassDetail(classId);
    toast.success('已移除学生');
  };

  const handleCopyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success('邀请码已复制到剪贴板');
  };

  const openEditDialog = (cls: Class) => {
    setSelectedClass(cls);
    setEditClassName(cls.name);
    setEditClassDesc(cls.description || '');
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">创建与管理班级</h1>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-white text-blue-700 hover:bg-slate-100">
                <Plus className="h-4 w-4" />
                创建班级
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>创建新班级</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="班级名称" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
                <Input placeholder="班级描述（可选）" value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} />
                <Button className="w-full" disabled={!newClassName.trim()} onClick={handleCreateClass}>确认创建</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-sky-100">班级总数</p><p className="text-2xl font-semibold">{classStats.totalClasses}</p></div>
          <div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-sky-100">授课学生总数</p><p className="text-2xl font-semibold">{classStats.totalStudents}</p></div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-14 text-center text-sm text-muted-foreground">加载中...</div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 py-14 text-center">
          <GraduationCap className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无班级，请先创建。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{cls.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{cls.description || '暂无班级描述'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(cls)}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{cls._count?.students || 0} 名学生</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" />{cls._count?.homeworks || 0} 份作业</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-blue-50 p-3">
                  <Badge variant="secondary">邀请码</Badge>
                  <code className="font-mono text-base font-semibold text-blue-700">{cls.inviteCode}</code>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => handleCopyInviteCode(cls.inviteCode)}><Copy className="h-4 w-4" /></Button>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">学生列表</p>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => fetchClassDetail(cls.id)}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
                  </div>
                  <div className="max-h-52 space-y-2 overflow-auto">
                    {cls.students?.length ? cls.students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between rounded-lg border p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8"><AvatarImage src={student.avatar || undefined} /><AvatarFallback>{student.name[0]}</AvatarFallback></Avatar>
                          <div><p className="text-sm font-medium">{student.name}</p><p className="text-xs text-muted-foreground">{student.email}</p></div>
                        </div>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleRemoveStudent(cls.id, student.id, student.name)}><UserMinus className="h-4 w-4" /></Button>
                      </div>
                    )) : <p className="py-4 text-center text-sm text-muted-foreground">暂无学生</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑班级</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input value={editClassName} onChange={(e) => setEditClassName(e.target.value)} />
            <Input value={editClassDesc} onChange={(e) => setEditClassDesc(e.target.value)} />
            <Button className="w-full" disabled={!editClassName.trim()} onClick={handleUpdateClass}>保存修改</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
