"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { OctagonAlert, CheckCircle2 } from "lucide-react";
import { authClient } from "../../lib/auth-client";

const resetSchema = z.object({
  newPassword: z.string().min(8, {
    message: "密码至少 8 位",
  }),
  confirmPassword: z.string().min(1, {
    message: "请再次输入新密码",
  }),
});

const FALLBACK_COVER = "/bg.jpg";

const AuthShaderBackground = dynamicImport(
  () => import("@/modules/auth/ui/components/auth-shader-background"),
  { ssr: false },
);

export const ResetPasswordView = ({ coverId }: { coverId?: string | null }) => {
  const [checked, setChecked] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [cover, setCover] = useState(
    coverId ? `/api/photo/v2/${coverId}?v=display` : FALLBACK_COVER,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    setToken(tokenParam);
    setInvalidLink(!tokenParam || params.get("error") === "INVALID_TOKEN");
    setChecked(true);
  }, []);

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: z.infer<typeof resetSchema>) => {
    if (!token) {
      setError("缺少重置凭证，请从邮件中的链接进入本页面");
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setError(null);
    setPending(true);

    authClient.resetPassword(
      {
        newPassword: values.newPassword,
        token,
      },
      {
        onSuccess: () => {
          setPending(false);
          setDone(true);
        },
        onError: ({ error }) => {
          setPending(false);
          setError(error.message ?? "重置失败，请稍后重试");
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-sky-100 via-indigo-50 to-rose-100">
        <AuthShaderBackground coverUrl={cover} playing />
      </div>
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[22px] border border-white/20 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_24px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-black/40">
        <div className="p-6 md:p-8">
          {checked && invalidLink && !done ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <OctagonAlert className="h-10 w-10 text-destructive" />
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">链接已失效</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  重置链接无效或已超过 15 分钟有效期，请返回登录页重新发起找回。
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/sign-in">返回登录</Link>
              </Button>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">密码已重置成功</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  所有设备已退出登录，请使用新密码重新登录后台。
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/sign-in">前往登录</Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-6"
              >
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">重置密码</h1>
                  <p className="text-muted-foreground text-balance">
                    设置一个新的登录密码
                  </p>
                </div>

                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新密码</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="至少 8 位"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>确认新密码</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="再次输入新密码"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!!error && (
                  <Alert className="bg-destructive/10 border-none">
                    <OctagonAlert className="h-4 w-4 text-destructive!" />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || !checked}
                >
                  {pending && <Spinner />}
                  重置密码
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
};
