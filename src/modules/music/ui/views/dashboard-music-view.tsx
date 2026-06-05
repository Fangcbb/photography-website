"use client";

import { useState, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Music as MusicIcon, Upload } from "lucide-react";

export const LoadingStatus = () => (
  <div className="flex items-center justify-center h-[50vh]">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

export const ErrorStatus = () => (
  <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
    <p className="text-muted-foreground">加载失败，请刷新页面重试</p>
    <Button onClick={() => window.location.reload()}>刷新页面</Button>
  </div>
);

interface MusicFormData {
  title: string;
  artist: string;
  album: string;
  musicUrl: string;
  coverUrl: string;
  genre: string;
  visibility: "public" | "private";
}

const initialFormData: MusicFormData = {
  title: "",
  artist: "",
  album: "",
  musicUrl: "",
  coverUrl: "",
  genre: "",
  visibility: "public",
};

// 上传文件到 S3
async function uploadFileToS3(
  file: File,
  presignedUrl: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error("上传失败"));
      }
    };

    xhr.onerror = () => reject(new Error("上传失败"));
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

export const DashboardMusicView = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const musicInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MusicFormData>(initialFormData);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 获取音乐列表
  const { data } = useSuspenseQuery(trpc.music.getAll.queryOptions({
    limit: 50,
    search: search || undefined,
  }));

  // S3 上传 URL
  const createMusicUploadUrl = useMutation(
    trpc.s3.createPresignedUrl.mutationOptions()
  );
  const createCoverUploadUrl = useMutation(
    trpc.s3.createPresignedUrl.mutationOptions()
  );

  // 创建音乐
  const createMutation = useMutation(
    trpc.music.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setIsAddOpen(false);
        resetForm();
        toast.success("音乐添加成功");
      },
      onError: (error: any) => {
        toast.error(`添加失败: ${error.message}`);
      },
    })
  );

  // 更新音乐
  const updateMutation = useMutation(
    trpc.music.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setIsEditOpen(false);
        setSelectedId(null);
        resetForm();
        toast.success("音乐更新成功");
      },
      onError: (error: any) => {
        toast.error(`更新失败: ${error.message}`);
      },
    })
  );

  // 删除音乐
  const deleteMutation = useMutation(
    trpc.music.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setIsDeleteOpen(false);
        setSelectedId(null);
        toast.success("音乐删除成功");
      },
      onError: (error: any) => {
        toast.error(`删除失败: ${error.message}`);
      },
    })
  );

  const resetForm = () => {
    setFormData(initialFormData);
    setMusicFile(null);
    setCoverFile(null);
    setUploading(false);
    setUploadProgress(0);
  };

  // 选择音乐文件
  const handleMusicSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMusicFile(file);
      // 自动从文件名提取标题
      if (!formData.title.trim()) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        setFormData(prev => ({ ...prev, title: fileName }));
      }
      toast.success(`已选择音乐文件: ${file.name}`);
    }
  };

  // 选择封面文件
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      toast.success(`已选择封面文件: ${file.name}`);
    }
  };

  // 上传音乐和封面
  const handleAdd = async () => {
    if (!formData.title) {
      toast.error("请填写标题");
      return;
    }
    
    // 必须有音乐文件或音乐URL
    if (!musicFile && !formData.musicUrl) {
      toast.error("请选择音乐文件或输入音乐URL");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      let musicKey = formData.musicUrl;
      let coverKey = formData.coverUrl;

      // 上传音乐文件
      if (musicFile) {
        const ext = musicFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        setUploadProgress(10);
        const { presignedUrl, key } = await createMusicUploadUrl.mutateAsync({
          filename: fileName,
          contentType: musicFile.type as any,
          size: musicFile.size,
          folder: "music",
        });

        setUploadProgress(30);
        await uploadFileToS3(musicFile, presignedUrl, (progress) => {
          setUploadProgress(30 + progress * 0.4);
        });
        
        musicKey = key;
        setUploadProgress(70);
      }

      // 上传封面文件
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        const { presignedUrl, key } = await createCoverUploadUrl.mutateAsync({
          filename: fileName,
          contentType: coverFile.type as any,
          size: coverFile.size,
          folder: "music-covers",
        });

        await uploadFileToS3(coverFile, presignedUrl, (progress) => {
          setUploadProgress(70 + progress * 0.2);
        });
        
        coverKey = key;
        setUploadProgress(90);
      }

      // 创建音乐记录
      await createMutation.mutateAsync({
        ...formData,
        musicUrl: musicKey,
        coverUrl: coverKey,
      });

      setUploadProgress(100);
    } catch (error: any) {
      toast.error(`上传失败: ${error.message}`);
      setUploading(false);
    }
  };

  const handleEdit = () => {
    if (!selectedId) return;
    updateMutation.mutate({ id: selectedId, ...formData });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteMutation.mutate({ id: selectedId });
  };

  const openEditDialog = (music: any) => {
    setSelectedId(music.id);
    setFormData({
      title: music.title || "",
      artist: music.artist || "",
      album: music.album || "",
      musicUrl: music.musicUrl || "",
      coverUrl: music.coverUrl || "",
      genre: music.genre || "",
      visibility: music.visibility || "public",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setSelectedId(id);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">音乐管理</h2>
          <p className="text-muted-foreground">
            上传音乐文件和封面，管理网站音乐播放器的音乐列表
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加音乐
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>添加音乐</DialogTitle>
              <DialogDescription>
                选择本地音乐文件上传，或直接输入音乐URL
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* 音乐文件上传 */}
              <div className="grid gap-2">
                <Label>音乐文件</Label>
                <input
                  ref={musicInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleMusicSelect}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => musicInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {musicFile ? musicFile.name : "选择音乐文件"}
                  </Button>
                </div>
                {musicFile && (
                  <p className="text-xs text-muted-foreground">
                    已选择: {musicFile.name} ({(musicFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* 或输入音乐URL */}
              <div className="grid gap-2">
                <Label>或输入音乐URL</Label>
                <Input
                  value={formData.musicUrl}
                  onChange={(e) => setFormData({ ...formData, musicUrl: e.target.value })}
                  placeholder="https://cdn.fangc.cc/music/xxx.mp3"
                  disabled={!!musicFile}
                />
              </div>

              {/* 封面图片上传 */}
              <div className="grid gap-2">
                <Label>封面图片</Label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => coverInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {coverFile ? coverFile.name : "选择封面图片"}
                  </Button>
                </div>
              </div>

              {/* 或输入封面URL */}
              <div className="grid gap-2">
                <Label>或输入封面URL</Label>
                <Input
                  value={formData.coverUrl}
                  onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                  placeholder="https://cdn.fangc.cc/music/xxx.jpg"
                  disabled={!!coverFile}
                />
              </div>

              {/* 基本信息 */}
              <div className="grid gap-2">
                <Label htmlFor="title">标题 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="歌曲名称"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="artist">艺术家</Label>
                  <Input
                    id="artist"
                    value={formData.artist}
                    onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                    placeholder="演唱者"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="album">专辑</Label>
                  <Input
                    id="album"
                    value={formData.album}
                    onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                    placeholder="专辑名称"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="genre">流派</Label>
                  <Input
                    id="genre"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    placeholder="流行、摇滚等"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>可见性</Label>
                  <Select
                    value={formData.visibility}
                    onValueChange={(value: "public" | "private") =>
                      setFormData({ ...formData, visibility: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">公开</SelectItem>
                      <SelectItem value="private">私有</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 上传进度 */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>上传中...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }} disabled={uploading}>
                取消
              </Button>
              <Button onClick={handleAdd} disabled={uploading || createMutation.isPending}>
                {(uploading || createMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploading ? "上传中..." : "添加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索音乐..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-sm text-muted-foreground">
          共 {data?.total || 0} 首音乐
        </span>
      </div>

      {/* 音乐列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MusicIcon className="h-5 w-5" />
            音乐列表
          </CardTitle>
          <CardDescription>
            管理所有音乐，点击编辑或删除
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.data && data.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>艺术家</TableHead>
                  <TableHead>专辑</TableHead>
                  <TableHead>流派</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((music: any) => (
                  <TableRow key={music.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {music.coverUrl && (
                          <img
                            src={music.coverUrl}
                            alt={music.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        )}
                        {music.title}
                      </div>
                    </TableCell>
                    <TableCell>{music.artist || "-"}</TableCell>
                    <TableCell>{music.album || "-"}</TableCell>
                    <TableCell>{music.genre || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          music.visibility === "public"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {music.visibility === "public" ? "公开" : "私有"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(music)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(music.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无音乐，点击上方按钮添加
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑音乐</DialogTitle>
            <DialogDescription>修改音乐信息</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>艺术家</Label>
                <Input
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>专辑</Label>
                <Input
                  value={formData.album}
                  onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>音乐URL</Label>
              <Input
                value={formData.musicUrl}
                onChange={(e) => setFormData({ ...formData, musicUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>封面URL</Label>
              <Input
                value={formData.coverUrl}
                onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>流派</Label>
                <Input
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>可见性</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: "public" | "private") =>
                    setFormData({ ...formData, visibility: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">公开</SelectItem>
                    <SelectItem value="private">私有</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这首音乐吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
